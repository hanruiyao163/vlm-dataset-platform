from __future__ import annotations

import asyncio
import base64
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from openai import AsyncOpenAI, OpenAIError

from ..models import Settings


class LLMServiceError(Exception):
    pass


@dataclass
class ModelProfile:
    name: str
    base_url: str
    api_key: str
    model: str


def _truncate_text(value: str, limit: int = 400) -> str:
    compact = " ".join(value.split())
    if len(compact) <= limit:
        return compact
    return f"{compact[:limit]}..."


def _debug_response_summary(response: Any) -> str:
    try:
        payload = response.model_dump() if hasattr(response, "model_dump") else response
    except Exception:
        payload = None

    if isinstance(payload, dict):
        keys = ", ".join(sorted(str(key) for key in payload.keys())) or "无"
        error_payload = payload.get("error")
        if isinstance(error_payload, dict):
            error_summary = _truncate_text(json.dumps(error_payload, ensure_ascii=False))
            return f"顶层字段: {keys}；error: {error_summary}"
        return f"顶层字段: {keys}；原始摘要: {_truncate_text(json.dumps(payload, ensure_ascii=False))}"

    if payload is not None:
        return f"返回类型: {type(payload).__name__}；原始摘要: {_truncate_text(str(payload))}"

    return f"返回类型: {type(response).__name__}"


def _normalize_base_url(base_url: str) -> str:
    return base_url.rstrip("/")


def list_model_profiles(settings: Settings) -> list[dict[str, str]]:
    try:
        parsed = json.loads(settings.model_profiles_json or "[]")
    except json.JSONDecodeError:
        parsed = []

    profiles = []
    for item in parsed:
        if not isinstance(item, dict):
            continue
        name = str(item.get("name", "")).strip()
        base_url = str(item.get("base_url", "")).strip()
        api_key = str(item.get("api_key", "")).strip()
        model = str(item.get("model", "")).strip()
        if name and base_url and api_key and model:
            profiles.append({"name": name, "base_url": base_url, "api_key": api_key, "model": model})

    if profiles:
        return profiles

    legacy_model = settings.model.strip()
    if settings.base_url and settings.api_key and legacy_model:
        return [
            {
                "name": legacy_model,
                "base_url": settings.base_url,
                "api_key": settings.api_key,
                "model": legacy_model,
            }
        ]
    return []


def resolve_model_profile(settings: Settings, selected_name: str | None = None) -> ModelProfile:
    profiles = [ModelProfile(**profile) for profile in list_model_profiles(settings)]
    if not profiles:
        raise LLMServiceError("模型配置不完整，请先在设置页添加至少一个可用模型。")

    target_name = (selected_name or settings.model or profiles[0].name).strip()
    for profile in profiles:
        if profile.name == target_name:
            return profile
    return profiles[0]


async def _chat_completion(
    profile: ModelProfile,
    timeout_seconds: int,
    messages: list[dict[str, Any]],
    response_format: dict[str, Any] | None = None,
) -> str:
    if not profile.base_url or not profile.api_key or not profile.model:
        raise LLMServiceError("模型配置不完整，请先在设置页填写 API Key、Base URL 和模型名。")

    client = AsyncOpenAI(
        api_key=profile.api_key,
        base_url=_normalize_base_url(profile.base_url),
        timeout=float(timeout_seconds),
        max_retries=0,
    )
    request_kwargs: dict[str, Any] = {
        "model": profile.model,
        "messages": messages,
    }
    if response_format is not None:
        request_kwargs["response_format"] = response_format

    try:
        response = await client.chat.completions.create(**request_kwargs)
    except OpenAIError as exc:
        raise LLMServiceError(f"模型调用失败：{exc}") from exc
    finally:
        await client.close()

    try:
        content = response.choices[0].message.content
        if not content:
            raise LLMServiceError("模型未返回可用内容。")
        return content.strip()
    except (IndexError, AttributeError, TypeError) as exc:
        debug_summary = _debug_response_summary(response)
        raise LLMServiceError(f"模型返回结构不符合 OpenAI 兼容格式。{debug_summary}") from exc


def _image_to_data_url(file_path: Path) -> str:
    suffix = file_path.suffix.lower().lstrip(".") or "png"
    mime = "jpeg" if suffix == "jpg" else suffix
    encoded = base64.b64encode(file_path.read_bytes()).decode("utf-8")
    return f"data:image/{mime};base64,{encoded}"


async def describe_image(settings: Settings, prompt: str, file_path: Path, model_profile: str | None = None) -> str:
    profile = resolve_model_profile(settings, model_profile)
    messages = [
        {
            "role": "user",
            "content": [
                {"type": "text", "text": prompt},
                {"type": "image_url", "image_url": {"url": _image_to_data_url(file_path)}},
            ],
        }
    ]
    return await _chat_completion(profile, settings.timeout_seconds, messages)


async def describe_from_question(
    settings: Settings,
    prompt: str,
    file_path: Path,
    question: str,
    model_profile: str | None = None,
) -> str:
    profile = resolve_model_profile(settings, model_profile)
    text_prompt = f"{prompt}\n\n请结合下面这个问题和图片内容来生成描述：\n{question}"
    messages = [
        {
            "role": "user",
            "content": [
                {"type": "text", "text": text_prompt},
                {"type": "image_url", "image_url": {"url": _image_to_data_url(file_path)}},
            ],
        }
    ]
    return await _chat_completion(profile, settings.timeout_seconds, messages)


def _structured_items_schema(item_label: str) -> dict[str, Any]:
    return {
        "type": "json_schema",
        "json_schema": {
            "name": f"{item_label}_batch_response",
            "strict": True,
            "schema": {
                "type": "object",
                "properties": {
                    "items": {
                        "type": "array",
                        "items": {"type": "string"},
                    }
                },
                "required": ["items"],
                "additionalProperties": False,
            },
        },
    }


async def describe_image_batch(
    settings: Settings,
    prompt: str,
    file_path: Path,
    count: int,
    model_profile: str | None = None,
) -> list[str]:
    profile = resolve_model_profile(settings, model_profile)
    messages = [
        {
            "role": "user",
            "content": [
                {
                    "type": "text",
                    "text": (
                        f"{prompt}\n\n"
                        f"请一次性生成 {count} 条互不重复的图片描述。"
                        "必须以 structured output 返回 JSON 对象，字段名为 items，"
                        "其值为长度恰好等于请求数量的字符串数组。"
                    ),
                },
                {"type": "image_url", "image_url": {"url": _image_to_data_url(file_path)}},
            ],
        }
    ]
    content = await _chat_completion(
        profile,
        settings.timeout_seconds,
        messages,
        response_format=_structured_items_schema("description"),
    )
    return _parse_structured_items(content, count, "描述")


async def describe_from_question_batch(
    settings: Settings,
    prompt: str,
    file_path: Path,
    count: int,
    question: str,
    model_profile: str | None = None,
) -> list[str]:
    profile = resolve_model_profile(settings, model_profile)
    messages = [
        {
            "role": "user",
            "content": [
                {
                    "type": "text",
                    "text": (
                        f"{prompt}\n\n"
                        f"请结合下面这个问题和图片内容，一次性生成 {count} 条互不重复的图片描述：\n"
                        f"{question}\n\n"
                        "必须以 structured output 返回 JSON 对象，字段名为 items，"
                        "其值为长度恰好等于请求数量的字符串数组。"
                    ),
                },
                {"type": "image_url", "image_url": {"url": _image_to_data_url(file_path)}},
            ],
        }
    ]
    content = await _chat_completion(
        profile,
        settings.timeout_seconds,
        messages,
        response_format=_structured_items_schema("description"),
    )
    return _parse_structured_items(content, count, "描述")


async def generate_question(
    settings: Settings,
    prompt: str,
    file_path: Path,
    description: str | None = None,
    use_image: bool = True,
    model_profile: str | None = None,
) -> str:
    profile = resolve_model_profile(settings, model_profile)
    text_prompt = prompt
    if description:
        text_prompt = f"{prompt}\n\n图片描述参考：\n{description}"
    content_items: list[dict[str, Any]] = [{"type": "text", "text": text_prompt}]
    if use_image:
        content_items.append({"type": "image_url", "image_url": {"url": _image_to_data_url(file_path)}})
    messages = [{"role": "user", "content": content_items}]
    return await _chat_completion(profile, settings.timeout_seconds, messages)


async def generate_question_batch(
    settings: Settings,
    prompt: str,
    file_path: Path,
    count: int,
    description: str | None = None,
    use_image: bool = True,
    model_profile: str | None = None,
) -> list[str]:
    profile = resolve_model_profile(settings, model_profile)
    text_prompt = prompt
    if description:
        text_prompt = f"{prompt}\n\n图片描述参考：\n{description}"
    content_items: list[dict[str, Any]] = [
        {
            "type": "text",
            "text": (
                f"{text_prompt}\n\n"
                f"请一次性生成 {count} 条互不重复的问题。"
                "必须以 structured output 返回 JSON 对象，字段名为 items，"
                "其值为长度恰好等于请求数量的字符串数组。"
            ),
        }
    ]
    if use_image:
        content_items.append({"type": "image_url", "image_url": {"url": _image_to_data_url(file_path)}})
    messages = [{"role": "user", "content": content_items}]
    content = await _chat_completion(
        profile,
        settings.timeout_seconds,
        messages,
        response_format=_structured_items_schema("question"),
    )
    return _parse_structured_items(content, count, "问题")


def _parse_structured_items(content: str, expected_count: int, label: str) -> list[str]:
    try:
        payload = json.loads(content)
    except json.JSONDecodeError as exc:
        raise LLMServiceError(f"Structured output 解析失败：{label}结果不是合法 JSON。") from exc

    items = payload.get("items")
    if not isinstance(items, list):
        raise LLMServiceError(f"Structured output 解析失败：{label}结果缺少 items 数组。")

    normalized = [str(item).strip() for item in items if str(item).strip()]
    if len(normalized) != expected_count:
        raise LLMServiceError(
            f"Structured output 数量不匹配：期望 {expected_count} 条{label}，实际返回 {len(normalized)} 条。"
        )
    return normalized


async def test_connection(settings: Settings, prompt: str, model_profile: str | None = None) -> str:
    profile = resolve_model_profile(settings, model_profile)
    return await _chat_completion(profile, settings.timeout_seconds, [{"role": "user", "content": prompt}])


async def run_limited(coroutines: list, concurrency: int):
    semaphore = asyncio.Semaphore(concurrency)

    async def runner(coroutine):
        async with semaphore:
            return await coroutine

    return await asyncio.gather(*(runner(coro) for coro in coroutines), return_exceptions=True)
