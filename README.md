# Dataset Platform

单用户、本地优先的执法记录仪违规行为图像微调数据集平台。

## Tech Stack

- Frontend: Vite + React + TypeScript + TanStack Router + TanStack Query + Tailwind CSS
- Backend: FastAPI + SQLAlchemy + SQLite + httpx

## Quick Start

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Backend

建议使用 Python 3.11+:

```bash
pip install -r backend/requirements.txt
python -m uvicorn backend.app.main:app --reload
```

默认后端地址为 `http://127.0.0.1:8000`，前端开发服务器会将 `/api` 代理到该地址。

## Features

- 模型配置管理与连通性测试
- 项目和批次管理
- 文件夹图片批量上传与预览
- 图片描述批量生成与追加生成
- 基于描述或提示词的问题批量生成与追加生成
- ShareGPT 单轮格式导出

## Notes

- 图片原始文件默认落在 `backend/uploads/`
- 导出文件默认落在 `backend/exports/`
- SQLite 数据库默认落在 `backend/data/app.db`
