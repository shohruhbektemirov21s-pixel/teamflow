"""Bounded WSGI workers; tune from measurements, not registered user count."""
import os

bind = "0.0.0.0:8000"
worker_class = "gthread"
workers = int(os.environ.get("WEB_WORKERS", "4"))
threads = int(os.environ.get("WEB_THREADS", "4"))
timeout = 60
graceful_timeout = 30
keepalive = 5
# gthread recycling interrupted in-flight writes in the measured workload.
# Enable only after testing a graceful drain strategy for the deployment.
max_requests = int(os.environ.get("WEB_MAX_REQUESTS", "0"))
max_requests_jitter = 300 if max_requests else 0
accesslog = "-"
errorlog = "-"
capture_output = True
forwarded_allow_ips = "*"  # Gunicorn is accessible only on the private container network.
