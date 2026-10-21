FROM python:3.12-slim
WORKDIR /load
COPY backend/loadtesting/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/loadtesting/locustfile.py ./
ENTRYPOINT ["locust", "-f", "/load/locustfile.py"]
