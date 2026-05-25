import json
from openai import OpenAI
from app.config import get_settings

settings = get_settings()


class SeedClient:
    def __init__(self):
        self.client = OpenAI(
            api_key=settings.volc_api_key,
            base_url=settings.volc_base_url,
        )
        self.model = settings.doubao_seed_ep

    def chat(self, messages, temperature=0.7, max_tokens=4096, response_format=None):
        if settings.mock_mode:
            raise RuntimeError(
                "MOCK_MODE 已关闭：请在项目根目录 .env 设置 MOCK_MODE=false 并使用真实 Seed API"
            )
        kwargs = {
            "model": self.model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        if response_format:
            kwargs["response_format"] = response_format
        resp = self.client.chat.completions.create(**kwargs)
        return resp.choices[0].message.content

    def generate_json(self, system_prompt: str, user_prompt: str, temperature=0.7):
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ]
        content = self.chat(messages, temperature=temperature, response_format={"type": "json_object"})
        return json.loads(content)


_seed_client = None


def get_seed_client() -> SeedClient:
    global _seed_client
    if _seed_client is None:
        _seed_client = SeedClient()
    return _seed_client
