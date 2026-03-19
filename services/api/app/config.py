from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    NEXT_PUBLIC_SUPABASE_URL: str = ""
    NEXT_PUBLIC_SUPABASE_ANON_KEY: str = ""
    SUPABASE_SERVICE_ROLE_KEY: str = ""
    OPENAI_API_KEY: str = ""
    DEEPGRAM_API_KEY: str = ""
    NEXT_PUBLIC_API_URL: str = "http://localhost:8000"

    @property
    def SUPABASE_URL(self) -> str:
        return self.NEXT_PUBLIC_SUPABASE_URL

    @property
    def SUPABASE_KEY(self) -> str:
        return self.SUPABASE_SERVICE_ROLE_KEY

    model_config = SettingsConfigDict(env_file="../../.env", extra="ignore")


settings = Settings()
