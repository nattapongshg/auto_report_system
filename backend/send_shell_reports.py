"""Generate all Shell location reports for March 2026 and send summary email."""

import json
import os
import asyncio
from datetime import datetime

from app.engine.privilege_calc import process_rows, refresh_cache
from app.engine.excel_builder import build_report

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "output")
os.makedirs(OUTPUT_DIR, exist_ok=True)


async def main():
    # Load raw data
    with open("../march-2026-raw.json", "r", encoding="utf-8") as f:
        data = json.load(f)
    raw_rows = data["rows"]
    col_names = data["cols"]

    await refresh_cache()

    # Find all Shell locations
    loc_idx = col_names.index("location_name")
    shell_locs = sorted(set(
        r[loc_idx] for r in raw_rows if r[loc_idx] and "Shell" in r[loc_idx]
    ))

    print(f"Processing {len(shell_locs)} Shell locations...\n")

    results = []

    for loc_name in shell_locs:
        processed = await process_rows(raw_rows, col_names, loc_name)
        if not processed:
            continue

        total_kwh = sum(float(r.get("kwh", 0)) for r in processed)
        revenue = sum(float(r.get("_revenue", 0)) for r in processed)
        electricity_est = total_kwh * 3  # estimate 3 THB/kWh

        manual_inputs = {
            "date_start": "2026-03-01",
            "date_end": "2026-03-31",
            "electricity_cost": electricity_est,
            "internet_cost": 598,
            "etax": 184,
            "transfer_fee": 30,
            "transaction_fee_rate": 0.0365,
            "location_share_rate": 0.40,
        }

        excel_bytes = build_report(
            rows=processed,
            location_name=loc_name,
            manual_inputs=manual_inputs,
        )

        safe_name = loc_name.replace(" ", "_").replace("/", "_")[:50]
        filename = f"{safe_name}_2026-03.xlsx"
        output_path = os.path.join(OUTPUT_DIR, filename)

        with open(output_path, "wb") as f:
            f.write(excel_bytes.read())

        results.append({
            "location": loc_name,
            "rows": len(processed),
            "kwh": round(total_kwh, 2),
            "revenue": round(revenue, 2),
            "electricity_est": round(electricity_est, 2),
            "filename": filename,
            "path": output_path,
        })
        print(f"  {loc_name}: {len(processed)} rows, {total_kwh:.0f} kWh, rev={revenue:.0f}")

    print(f"\n{len(results)} reports generated!")

    # Summary stats
    total_locs = len(results)
    total_rows = sum(r["rows"] for r in results)
    total_kwh = sum(r["kwh"] for r in results)
    total_revenue = sum(r["revenue"] for r in results)
    total_elec = sum(r["electricity_est"] for r in results)

    # Build station rows HTML
    rows_html = ""
    for r in sorted(results, key=lambda x: -x["revenue"]):
        rows_html += (
            '<tr>'
            f'<td style="padding:6px 10px;border-bottom:1px solid #f0f0f0;font-size:13px;">{r["location"]}</td>'
            f'<td style="padding:6px 10px;border-bottom:1px solid #f0f0f0;text-align:right;font-size:13px;">{r["rows"]}</td>'
            f'<td style="padding:6px 10px;border-bottom:1px solid #f0f0f0;text-align:right;font-size:13px;">{r["kwh"]:,.0f}</td>'
            f'<td style="padding:6px 10px;border-bottom:1px solid #f0f0f0;text-align:right;font-size:13px;font-weight:600;">{r["revenue"]:,.2f}</td>'
            '</tr>'
        )

    email_html = f"""
    <div style="font-family:'Inter',Arial,sans-serif;max-width:800px;margin:0 auto;">
        <div style="background:linear-gradient(135deg,#1a1a2e 0%,#16213e 100%);padding:28px 32px;border-radius:16px 16px 0 0;">
            <h1 style="color:white;margin:0;font-size:20px;font-weight:600;">Monthly Report Summary</h1>
            <p style="color:rgba(255,255,255,0.6);margin:6px 0 0;font-size:13px;">Shell Locations - March 2026</p>
        </div>

        <div style="padding:28px 32px;border:1px solid #e8e8e8;border-top:none;border-radius:0 0 16px 16px;">
            <p style="color:#121212;font-size:14px;line-height:1.6;">
                Hi team,<br><br>
                Monthly reports for all <strong>{total_locs} Shell locations</strong> for March 2026 have been generated.
                Below is the summary. Top 10 station reports are attached.
            </p>

            <table style="width:100%;border-collapse:separate;border-spacing:12px 0;margin:20px 0;">
                <tr>
                    <td style="background:#FDF2F3;border-radius:12px;padding:16px;text-align:center;">
                        <div style="color:#636E72;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;">Total Revenue</div>
                        <div style="color:#8B1927;font-size:22px;font-weight:700;margin-top:4px;">{total_revenue:,.0f}</div>
                        <div style="color:#636E72;font-size:11px;">THB</div>
                    </td>
                    <td style="background:#E8F8F0;border-radius:12px;padding:16px;text-align:center;">
                        <div style="color:#636E72;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;">Total Energy</div>
                        <div style="color:#0B8457;font-size:22px;font-weight:700;margin-top:4px;">{total_kwh:,.0f}</div>
                        <div style="color:#636E72;font-size:11px;">kWh</div>
                    </td>
                    <td style="background:#E3F0FF;border-radius:12px;padding:16px;text-align:center;">
                        <div style="color:#636E72;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;">Transactions</div>
                        <div style="color:#1565C0;font-size:22px;font-weight:700;margin-top:4px;">{total_rows:,}</div>
                        <div style="color:#636E72;font-size:11px;">invoices</div>
                    </td>
                    <td style="background:#FFF8E1;border-radius:12px;padding:16px;text-align:center;">
                        <div style="color:#636E72;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;">Est. Electricity</div>
                        <div style="color:#E65100;font-size:22px;font-weight:700;margin-top:4px;">{total_elec:,.0f}</div>
                        <div style="color:#636E72;font-size:11px;">THB (3 THB/kWh)</div>
                    </td>
                </tr>
            </table>

            <h3 style="font-size:14px;margin:24px 0 12px;color:#121212;">Station Breakdown</h3>
            <table style="width:100%;border-collapse:collapse;">
                <thead>
                    <tr style="background:#f8f9fa;">
                        <th style="padding:8px 10px;text-align:left;font-size:12px;color:#636E72;font-weight:500;">Location</th>
                        <th style="padding:8px 10px;text-align:right;font-size:12px;color:#636E72;font-weight:500;">Invoices</th>
                        <th style="padding:8px 10px;text-align:right;font-size:12px;color:#636E72;font-weight:500;">kWh</th>
                        <th style="padding:8px 10px;text-align:right;font-size:12px;color:#636E72;font-weight:500;">Revenue (THB)</th>
                    </tr>
                </thead>
                <tbody>{rows_html}</tbody>
                <tfoot>
                    <tr style="background:#f8f9fa;font-weight:700;">
                        <td style="padding:8px 10px;font-size:13px;">Total ({total_locs} locations)</td>
                        <td style="padding:8px 10px;text-align:right;font-size:13px;">{total_rows:,}</td>
                        <td style="padding:8px 10px;text-align:right;font-size:13px;">{total_kwh:,.0f}</td>
                        <td style="padding:8px 10px;text-align:right;font-size:13px;color:#8B1927;">{total_revenue:,.2f}</td>
                    </tr>
                </tfoot>
            </table>

            <p style="color:#636E72;font-size:12px;margin-top:20px;line-height:1.5;">
                <strong>Note:</strong> Electricity costs are estimated at 3 THB/kWh.
                Actual costs should be updated per location from PEA/MEA bills.
                Privilege revenue (ZEEKR, Mercedes, etc.) uses configured share rates.
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
    import resend
    resend.api_key = "re_69RLVNxX_PjFVXqU8smhoH7gDNj96GrdE"

    # Attach top 10 reports by revenue
    top_10 = sorted(results, key=lambda x: -x["revenue"])[:10]
    attachments = []
    for r in top_10:
        with open(r["path"], "rb") as f:
            attachments.append({
                "filename": r["filename"],
                "content": list(f.read()),
            })

    print(f"\nSending email with {len(attachments)} attachments...")

    result = resend.Emails.send({
        "from": "Sharge Reports <onboarding@resend.dev>",
        "to": ["nattapong.p@shargemgmt.com"],
        "subject": f"Monthly Report - Shell Locations (March 2026) - {total_locs} stations, {total_revenue:,.0f} THB",
        "html": email_html,
        "attachments": attachments,
    })

    print(f"Email sent! ID: {result.get('id')}")


if __name__ == "__main__":
    asyncio.run(main())
