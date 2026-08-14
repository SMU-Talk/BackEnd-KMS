# Cloud Run용 백엔드 이미지. 프론트엔드는 별도로 Vercel에 배포합니다(DEPLOY_CLOUDRUN.md 참고).
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt requirements.txt
COPY backend/requirements.txt backend/requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ backend/

# 임베딩 모델을 빌드 타임에 미리 받아 이미지에 포함시킵니다.
# Cloud Run은 요청이 없으면 인스턴스를 내렸다가(콜드스타트) 다시 띄우는데,
# 그때마다 모델을 다운로드하면 매번 느려지므로 미리 캐시해 둡니다.
# EMBEDDING_MODEL을 바꿨다면 아래 값도 함께 바꿔야 합니다.
ENV HF_HOME=/app/.cache/huggingface
RUN python -c "from langchain_huggingface import HuggingFaceEmbeddings; HuggingFaceEmbeddings(model_name='BAAI/bge-m3')"

WORKDIR /app/backend
EXPOSE 8080
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8080}"]
