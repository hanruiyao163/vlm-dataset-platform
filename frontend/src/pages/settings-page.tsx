import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useFieldArray, useForm } from "react-hook-form";
import { Bot, ChevronDown, Gauge, Link2, Plus, Trash2 } from "lucide-react";

import { api } from "@/lib/api";
import type { ModelSettings } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type FormValues = Omit<ModelSettings, "id">;

export function SettingsPage() {
  const { push } = useToast();
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["settings"], queryFn: api.getSettings });
  const form = useForm<FormValues>({
    defaultValues: {
      api_key: "",
      base_url: "",
      model: "",
      available_models_text: "",
      model_profiles: [{ name: "", model: "", base_url: "", api_key: "" }],
      default_description_prompt: "",
      default_question_prompt: "",
      default_concurrency: 3,
      timeout_seconds: 60,
    },
  });
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "model_profiles" });

  useEffect(() => {
    if (!query.data) return;
    form.reset({
      ...query.data,
      model_profiles:
        query.data.model_profiles.length > 0 ? query.data.model_profiles : [{ name: "", model: "", base_url: "", api_key: "" }],
    });
  }, [form, query.data]);

  const saveMutation = useMutation({
    mutationFn: api.updateSettings,
    onSuccess: (data) => {
      queryClient.setQueryData(["settings"], data);
      push("设置已保存");
    },
    onError: (error: Error) => push("保存失败", error.message),
  });

  const testMutation = useMutation({
    mutationFn: (modelProfile: string) => api.testSettings("请只回复 OK", modelProfile),
    onSuccess: (response) => push("连接测试完成", response.message),
    onError: (error: Error) => push("连接测试失败", error.message),
  });
  const watchedProfiles = form.watch("model_profiles");
  const selectedDefaultProfile = watchedProfiles.find((profile) => profile.name === form.watch("model"));

  return (
    <section>
      <PageHeader
        eyebrow="Settings"
        title="模型与全局生成参数"
        description="配置模型档案、工作台默认模型以及全局并发/超时参数。项目默认提示词现在跟随项目单独保存。"
      />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_360px]">
        <Card>
          <CardHeader>
            <CardTitle>模型档案</CardTitle>
            <CardDescription>为每个模型保存独立的名称、模型名、Base URL 和 API Key，工作台里可以直接切换使用。</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-5"
              onSubmit={form.handleSubmit((values) =>
                saveMutation.mutate({
                  ...values,
                  model:
                    values.model ||
                    values.model_profiles.find((profile) => profile.name.trim() || profile.model.trim())?.name ||
                    values.model_profiles.find((profile) => profile.model.trim())?.model ||
                    "",
                  model_profiles: values.model_profiles
                    .filter(
                      (profile) =>
                        profile.model.trim() &&
                        profile.base_url.trim() &&
                        profile.api_key.trim(),
                    )
                    .map((profile) => ({
                      ...profile,
                      name: profile.name.trim() || profile.model.trim(),
                    })),
                }),
              )}
            >
              <div className="space-y-4">
                {fields.map((field, index) => (
                  <details key={field.id} className="group/detail rounded-[24px] border border-border/60 bg-white/80 shadow-sm transition-all duration-200 hover:border-border/80 hover:shadow-soft">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-[24px] p-4 transition-colors hover:bg-secondary/30">
                      <div>
                        <p className="font-medium">
                          {watchedProfiles[index]?.name?.trim() || watchedProfiles[index]?.model?.trim() || `模型档案 ${index + 1}`}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {watchedProfiles[index]?.base_url?.trim() || "展开后填写连接信息"}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={(event) => {
                            event.preventDefault();
                            remove(index);
                          }}
                          disabled={fields.length === 1}
                        >
                          <Trash2 className="h-4 w-4" />
                          删除
                        </Button>
                        <span className="rounded-full bg-secondary p-2 text-secondary-foreground transition-transform group-open:rotate-180">
                          <ChevronDown className="h-4 w-4" />
                        </span>
                      </div>
                    </summary>
                    <div className="border-t border-border/60 p-4 pt-5">
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label>Base URL</Label>
                          <Input placeholder="https://api.openai.com/v1" {...form.register(`model_profiles.${index}.base_url`)} />
                        </div>
                        <div className="space-y-2">
                          <Label>API Key</Label>
                          <Input type="password" {...form.register(`model_profiles.${index}.api_key`)} />
                        </div>
                        <div className="space-y-2">
                          <Label>模型名</Label>
                          <Input placeholder="例如：gpt-4.1-mini" {...form.register(`model_profiles.${index}.model`)} />
                        </div>
                        <div className="space-y-2">
                          <Label>档案名（可选）</Label>
                          <Input placeholder="例如：OpenAI 主模型" {...form.register(`model_profiles.${index}.name`)} />
                        </div>
                      </div>
                      <div className="mt-4 flex justify-end">
                        <Button
                          type="button"
                          variant="outline"
                          disabled={
                            testMutation.isPending ||
                            !watchedProfiles[index]?.base_url?.trim() ||
                            !watchedProfiles[index]?.api_key?.trim() ||
                            !watchedProfiles[index]?.model?.trim()
                          }
                          onClick={() => {
                            const fallbackName = watchedProfiles[index]?.model?.trim();
                            const currentName = watchedProfiles[index]?.name?.trim();
                            const resolvedName = currentName || fallbackName;
                            if (!resolvedName) return;
                            if (!currentName) {
                              form.setValue(`model_profiles.${index}.name`, resolvedName, { shouldDirty: true });
                            }
                            testMutation.mutate(resolvedName);
                          }}
                        >
                          {testMutation.isPending ? "测试中..." : "测试连接"}
                        </Button>
                      </div>
                    </div>
                  </details>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => append({ name: "", model: "", base_url: "", api_key: "" })}
                >
                  <Plus className="h-4 w-4" />
                  新增模型档案
                </Button>
              </div>
              <div className="grid gap-5 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>工作台默认模型</Label>
                  <Select value={form.watch("model")} onValueChange={(value) => form.setValue("model", value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="选择默认模型档案" />
                    </SelectTrigger>
                    <SelectContent>
                      {watchedProfiles
                        .filter((profile) => profile.name.trim())
                        .map((profile) => (
                          <SelectItem key={profile.name} value={profile.name}>
                            {profile.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>默认并发</Label>
                  <Input type="number" min={1} max={20} {...form.register("default_concurrency", { valueAsNumber: true })} />
                </div>
                <div className="space-y-2">
                  <Label>超时秒数</Label>
                  <Input type="number" min={5} max={300} {...form.register("timeout_seconds", { valueAsNumber: true })} />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="submit" disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? "保存中..." : "保存设置"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>当前默认值</CardTitle>
              <CardDescription>这里的参数会作为图片描述和问题生成的起始配置。</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-[22px] border border-border/50 bg-white/85 p-4">
                <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                  <Bot className="h-4 w-4 text-primary" />
                  默认档案
                </div>
                <p className="text-sm text-muted-foreground">{selectedDefaultProfile?.name || query.data?.model || "尚未配置"}</p>
                <p className="mt-2 text-xs text-muted-foreground">可切换 {watchedProfiles.filter((profile) => profile.name.trim()).length} 个模型档案</p>
              </div>
              <div className="rounded-[22px] border border-border/50 bg-white/85 p-4">
                <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                  <Link2 className="h-4 w-4 text-primary" />
                  接口地址
                </div>
                <p className="break-all text-sm text-muted-foreground">{selectedDefaultProfile?.base_url || "尚未配置"}</p>
              </div>
              <div className="rounded-[22px] border border-border/50 bg-white/85 p-4">
                <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                  <Gauge className="h-4 w-4 text-primary" />
                  生成节奏
                </div>
                <p className="text-sm text-muted-foreground">
                  默认并发 {query.data?.default_concurrency ?? 3}，超时 {query.data?.timeout_seconds ?? 60} 秒。
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>使用建议</CardTitle>
              <CardDescription>先测试连接，再保存默认模板，后续批量生成会更顺手。</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm leading-6 text-muted-foreground">
              <p>如果你接的是 OpenAI 兼容服务，`Base URL` 通常以 `/v1` 结尾。</p>
              <p>默认描述提示词建议写清关注对象、行为、场景和关键物体，问题提示词则尽量保持单轮问答风格。</p>
              <p>本地模型吞吐较低时，可以先把默认并发降到 `1-2`，避免排队过多导致超时。</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}
