from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Supabase
    supabase_url: str = "https://tbvjmmmpbzpbdrvimdlp.supabase.co"
    supabase_service_key: str = ""
    supabase_anon_key: str = ""

    # Legacy (unused, kept for reference)
    database_url: str = ""

    # Email (SMTP)
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from_email: str = "Sharge Reports <reports@shargethailand.com>"
    smtp_use_tls: bool = True  # STARTTLS (port 587); set False + port 465 for SSL

    # Resend (legacy — kept so existing .env doesn't error, unused)
    resend_api_key: str = ""
    resend_from_email: str = ""

    # Metabase
    metabase_base_url: str = "https://metabase-dev.shargethailand.com"
    metabase_api_key: str = ""

    # AWS S3
    aws_s3_bucket: str = "sharge-reports"
    aws_region: str = "ap-southeast-1"
    aws_access_key_id: str = ""
    aws_secret_access_key: str = ""

    # AWS SES
    ses_sender_email: str = "reports@shargethailand.com"

    # App
    app_env: str = "development"

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
