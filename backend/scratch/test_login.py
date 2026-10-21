import requests
session = requests.Session()
response = session.get('http://127.0.0.1:8021/api/auth/csrf/')
print("CSRF:", response.status_code)
csrf_token = response.cookies.get('csrftoken') or session.cookies.get('csrftoken')
headers = {'X-CSRFToken': csrf_token, 'Referer': 'http://127.0.0.1:8021/kirish'}
response = session.post('http://127.0.0.1:8021/api/auth/login/', json={'username': 'oddiy', 'password': 'Demo-parol-2026'}, headers=headers)
print("LOGIN:", response.status_code, response.text)
