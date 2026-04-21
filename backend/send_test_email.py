"""One-off test of the new email_service HTML layout + summary table."""

from app.engine.email_service import send_report_email

summary = {
    "revenue": 39905.77,
    "tx_fee_rate": 0.0365,
    "vat_rate": 0.07,
    "location_share_rate": 0.40,
    "tx_fee": 1456.56,
    "vat_on_fee": 101.96,
    "transfer_fee": 30.00,
    "total_fee": 1588.52,
    "electricity_cost": 21527.28,
    "internet_cost": 598.00,
    "internet_incl_vat": 639.86,
    "etax": 184.00,
    "etax_incl_vat": 196.88,
    "remaining": 15953.23,
    "location_share": 6381.29,
    "vat_portion": 417.47,
    "before_vat": 5963.82,
}

result = send_report_email(
    to=["nattapong.p@shargemgmt.com"],
    location_name="BYD AP Automotive Mukdahan",
    year_month="2026-03",
    file_path="output/BYD_AP_Automotive_Mukdahan_2026-03-01_2026-03-31.xlsx",
    file_name="BYD_AP_Automotive_Mukdahan_2026-03.xlsx",
    summary=summary,
)
print(result)
