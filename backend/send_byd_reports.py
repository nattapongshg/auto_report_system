"""Generate BYD reports for 3 locations and send individual emails."""

import json
import os
import asyncio
from datetime import datetime

from app.engine.privilege_calc import process_rows, refresh_cache
from app.engine.excel_builder import build_report

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "output")
os.makedirs(OUTPUT_DIR, exist_ok=True)

LOCATIONS = [
    "BYD B1 Ratchaburi",
    "BYD SUSCO Beyond BKK Rama 9",
    "BYD Metromobile Rama 3",
]

SHARE_RATE = 0.40
TO_EMAIL = "nattapong.p@shargemgmt.com"
YEAR_MONTH = "2026-03"


async def main():
    with open("../march-2026-raw.json", "r", encoding="utf-8") as f:
        data = json.load(f)
    raw_rows = data["rows"]
    col_names = data["cols"]

    await refresh_cache()

    import resend
    resend.api_key = "re_69RLVNxX_PjFVXqU8smhoH7gDNj96GrdE"

    for loc_name in LOCATIONS:
        print(f"\n{'='*60}")
        print(f"Processing: {loc_name}")
        print(f"{'='*60}")

        processed = await process_rows(raw_rows, col_names, loc_name)
        if not processed:
            print(f"  No data found!")
            continue

        total_kwh = sum(float(r.get("kwh", 0)) for r in processed)
        revenue = sum(float(r.get("_revenue", 0)) for r in processed)
        electricity_est = total_kwh * 3

        manual_inputs = {
            "date_start": "2026-03-01",
            "date_end": "2026-03-31",
            "electricity_cost": electricity_est,
            "internet_cost": 598,
            "etax": 184,
            "transfer_fee": 30,
            "transaction_fee_rate": 0.0365,
            "location_share_rate": SHARE_RATE,
        }

        # Generate Excel
        excel_bytes = build_report(
            rows=processed,
            location_name=loc_name,
            manual_inputs=manual_inputs,
        )

        safe_name = loc_name.replace(" ", "_").replace("/", "_")[:50]
        filename = f"{safe_name}_{YEAR_MONTH}.xlsx"
        output_path = os.path.join(OUTPUT_DIR, filename)

        with open(output_path, "wb") as f:
            f.write(excel_bytes.read())

        # Calculate summary numbers (same logic as excel_builder)
        tx_fee = revenue * 0.0365
        vat_on_fee = tx_fee * 0.07
        total_fee = tx_fee + vat_on_fee + 30
        internet_incl_vat = 598 * 1.07
        etax_incl_vat = 184 * 1.07
        remaining = revenue - total_fee - electricity_est - internet_incl_vat - etax_incl_vat
        gp_share = remaining * SHARE_RATE
        vat_portion = gp_share - (gp_share / 1.07)
        before_vat = gp_share / 1.07

        print(f"  Rows: {len(processed)}")
        print(f"  kWh: {total_kwh:,.0f}")
        print(f"  Revenue: {revenue:,.2f}")
        print(f"  Est. Electricity: {electricity_est:,.2f}")
        print(f"  GP (remaining): {remaining:,.2f}")
        print(f"  Location Share (40%): {gp_share:,.2f}")
        print(f"  File: {filename}")

        # Build email
        email_html = f"""
        <div style="font-family:'Inter',Arial,sans-serif;max-width:700px;margin:0 auto;">
            <div style="background:linear-gradient(135deg,#1a1a2e 0%,#16213e 100%);padding:28px 32px;border-radius:16px 16px 0 0;">
                <h1 style="color:white;margin:0;font-size:20px;font-weight:600;">Monthly Station Report</h1>
                <p style="color:rgba(255,255,255,0.6);margin:6px 0 0;font-size:13px;">{loc_name} - March 2026</p>
            </div>

            <div style="padding:28px 32px;border:1px solid #e8e8e8;border-top:none;border-radius:0 0 16px 16px;">
                <p style="color:#121212;font-size:14px;line-height:1.6;">
                    Monthly report for <strong>{loc_name}</strong> is ready.
                    Please find the detailed Excel report attached.
                </p>

                <!-- KPI Cards -->
                <table style="width:100%;border-collapse:separate;border-spacing:10px 0;margin:20px 0;">
                    <tr>
                        <td style="background:#FDF2F3;border-radius:12px;padding:14px;text-align:center;width:25%;">
                            <div style="color:#636E72;font-size:10px;text-transform:uppercase;letter-spacing:0.5px;">Revenue</div>
                            <div style="color:#8B1927;font-size:20px;font-weight:700;margin-top:2px;">{revenue:,.0f}</div>
                            <div style="color:#636E72;font-size:10px;">THB</div>
                        </td>
                        <td style="background:#E8F8F0;border-radius:12px;padding:14px;text-align:center;width:25%;">
                            <div style="color:#636E72;font-size:10px;text-transform:uppercase;letter-spacing:0.5px;">Energy Sold</div>
                            <div style="color:#0B8457;font-size:20px;font-weight:700;margin-top:2px;">{total_kwh:,.0f}</div>
                            <div style="color:#636E72;font-size:10px;">kWh</div>
                        </td>
                        <td style="background:#E3F0FF;border-radius:12px;padding:14px;text-align:center;width:25%;">
                            <div style="color:#636E72;font-size:10px;text-transform:uppercase;letter-spacing:0.5px;">Transactions</div>
                            <div style="color:#1565C0;font-size:20px;font-weight:700;margin-top:2px;">{len(processed)}</div>
                            <div style="color:#636E72;font-size:10px;">invoices</div>
                        </td>
                        <td style="background:#F3E5F5;border-radius:12px;padding:14px;text-align:center;width:25%;">
                            <div style="color:#636E72;font-size:10px;text-transform:uppercase;letter-spacing:0.5px;">GP Share (40%)</div>
                            <div style="color:#6A1B9A;font-size:20px;font-weight:700;margin-top:2px;">{gp_share:,.0f}</div>
                            <div style="color:#636E72;font-size:10px;">THB</div>
                        </td>
                    </tr>
                </table>

                <!-- Revenue Breakdown -->
                <h3 style="font-size:14px;margin:24px 0 12px;color:#121212;">Revenue Breakdown</h3>
                <table style="width:100%;border-collapse:collapse;font-size:13px;">
                    <tr>
                        <td style="padding:8px 0;color:#636E72;">Revenue (Payment Amount)</td>
                        <td style="padding:8px 0;text-align:right;font-weight:600;">{revenue:,.2f}</td>
                    </tr>
                    <tr style="border-top:1px solid #f0f0f0;">
                        <td style="padding:8px 0;color:#636E72;">Transaction Fee (3.65%)</td>
                        <td style="padding:8px 0;text-align:right;color:#C62828;">-{tx_fee:,.2f}</td>
                    </tr>
                    <tr style="border-top:1px solid #f0f0f0;">
                        <td style="padding:8px 0;color:#636E72;">VAT on Fee + Transfer</td>
                        <td style="padding:8px 0;text-align:right;color:#C62828;">-{vat_on_fee + 30:,.2f}</td>
                    </tr>
                    <tr style="border-top:1px solid #f0f0f0;">
                        <td style="padding:8px 0;color:#636E72;">Est. Electricity Cost ({total_kwh:,.0f} kWh x 3 THB)</td>
                        <td style="padding:8px 0;text-align:right;color:#C62828;background:#FFF8E1;">-{electricity_est:,.2f}</td>
                    </tr>
                    <tr style="border-top:1px solid #f0f0f0;">
                        <td style="padding:8px 0;color:#636E72;">Internet + eTax (incl. VAT)</td>
                        <td style="padding:8px 0;text-align:right;color:#C62828;">-{internet_incl_vat + etax_incl_vat:,.2f}</td>
                    </tr>
                    <tr style="border-top:2px solid #e0e0e0;">
                        <td style="padding:10px 0;font-weight:700;">Gross Profit (GP)</td>
                        <td style="padding:10px 0;text-align:right;font-weight:700;font-size:15px;">{remaining:,.2f}</td>
                    </tr>
                </table>

                <!-- GP Sharing -->
                <div style="background:#DAEEF3;border-radius:12px;padding:20px;margin:20px 0;">
                    <h3 style="font-size:14px;margin:0 0 12px;color:#1a1a2e;">GP Sharing (40%)</h3>
                    <table style="width:100%;border-collapse:collapse;font-size:13px;">
                        <tr>
                            <td style="padding:6px 0;color:#636E72;"><strong>{loc_name}</strong> (40% of GP)</td>
                            <td style="padding:6px 0;text-align:right;font-weight:700;font-size:16px;color:#1a1a2e;">{gp_share:,.2f} THB</td>
                        </tr>
                        <tr style="border-top:1px solid rgba(0,0,0,0.1);">
                            <td style="padding:6px 0;color:#636E72;">Before VAT</td>
                            <td style="padding:6px 0;text-align:right;">{before_vat:,.2f}</td>
                        </tr>
                        <tr style="border-top:1px solid rgba(0,0,0,0.1);">
                            <td style="padding:6px 0;color:#636E72;">VAT (7%)</td>
                            <td style="padding:6px 0;text-align:right;">{vat_portion:,.2f}</td>
                        </tr>
                    </table>
                </div>

                <p style="color:#636E72;font-size:12px;margin-top:16px;line-height:1.5;">
                    <strong>Note:</strong> Electricity cost is estimated at 3 THB/kWh.
                    Please update with actual PEA/MEA bill amount for final calculation.
                </p>

                <hr style="border:none;border-top:1px solid #e8e8e8;margin:24px 0;">
                <p style="color:#9CA3AF;font-size:11px;">
                    Generated by Sharge Auto Report System<br>
                    {datetime.now().strftime('%d %B %Y, %H:%M')}
                </p>
            </div>
        </div>
        """

        # Send email
        with open(output_path, "rb") as f:
            attachment_content = list(f.read())

        result = resend.Emails.send({
            "from": "Sharge Reports <onboarding@resend.dev>",
            "to": [TO_EMAIL],
            "subject": f"Monthly Report - {loc_name} (March 2026) - Revenue {revenue:,.0f} THB | GP Share {gp_share:,.0f} THB",
            "html": email_html,
            "attachments": [{
                "filename": filename,
                "content": attachment_content,
            }],
        })

        print(f"  Email sent! ID: {result.get('id')}")


if __name__ == "__main__":
    asyncio.run(main())
