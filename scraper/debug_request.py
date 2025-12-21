"""
Debug script to test a single request and see the full response
"""
import requests
import json
from config import GRAPHQL_ENDPOINT, HEADERS, get_request_body

def debug_request():
    print("Testing StandVirtual GraphQL API...")
    print(f"Endpoint: {GRAPHQL_ENDPOINT}")
    print(f"\nHeaders:")
    for k, v in HEADERS.items():
        print(f"  {k}: {v}")

    body = get_request_body(1)
    print(f"\nRequest body:")
    print(json.dumps(body, indent=2))

    print("\nSending request...")
    response = requests.post(
        GRAPHQL_ENDPOINT,
        json=body,
        headers=HEADERS,
        timeout=30
    )

    print(f"\nStatus code: {response.status_code}")
    print(f"Response headers:")
    for k, v in response.headers.items():
        print(f"  {k}: {v}")

    print(f"\nResponse body:")
    try:
        data = response.json()
        print(json.dumps(data, indent=2, ensure_ascii=False)[:2000])
        if len(response.text) > 2000:
            print("... (truncated)")
    except:
        print(response.text[:2000])

if __name__ == "__main__":
    debug_request()
