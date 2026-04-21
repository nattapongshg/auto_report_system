"""Fetch March data from Q#1141, generate 5 BYD + 5 Bangchak reports, send email."""

import json
import os
import asyncio
from datetime import datetime

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "output")
os.makedirs(OUTPUT_DIR, exist_ok=True)

# Store fetched data for reuse
DATA_FILE = os.path.join(os.path.dirname(__file__), "data", "2026-03-q1141.json")


async def main():
    from app.engine.fetcher import fetch_date_range
    from app.engine.privilege_calc import process_rows, refresh_cache
    from app.engine.excel_builder import build_report

    await refresh_cache()

    # Fetch or load cached data
    if os.path.exists(DATA_FILE):
        print(f"Loading cached data from {DATA_FILE}...")
        with open(DATA_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
        raw_rows = data["rows"]
        col_names = data["cols"]
        print(f"Loaded {len(raw_rows)} rows")
    else:
        print("Fetching Q#1141 (March 2026)...")
        raw_rows, col_names = await fetch_date_range(
            question_id=1141,
            date_start="2026-03-01",
            date_end="2026-03-31",
            on_progress=lambda msg: print(f"  {msg}"),
        )
        os.makedirs(os.path.dirname(DATA_FILE), exist_ok=True)
        with open(DATA_FILE, "w", encoding="utf-8") as f:
            json.dump({"cols": col_names, "rows": raw_rows, "total": len(raw_rows)}, f, ensure_ascii=False)
        print(f"Saved {len(raw_rows)} rows to {DATA_FILE}")

    # Find BYD and Bangchak locations with most data
    loc_idx = col_names.index("location_name")
    loc_counts = {}
    for r in raw_rows:
        loc = r[loc_idx]
        if loc:
            loc_counts[loc] = loc_counts.get(loc, 0) + 1

    byd_locs = sorted(
        [(k, v) for k, v in loc_counts.items() if "BYD" in k],
        key=lambda x: -x[1]
    )[:5]

    bgn_locs = sorted(
        [(k, v) for k, v in loc_counts.items() if k.startswith("Bangchak")],
        key=lambda x: -x[1]
    )[:5]

    targets = byd_locs + bgn_locs
    print(f"\nTarget locations ({len(targets)}):")
    for loc, cnt in targets:
        print(f"  {cnt:>5} rows  {loc}")

    import resend
    resend.api_key = "re_69RLVNxX_PjFVXqU8smhoH7gDNj96GrdE"

    results = []

    for loc_name, _ in targets:
        print(f"\nProcessing: {loc_name}...")
        processed = await process_rows(raw_rows, col_names, loc_name)
        if not processed:
            print("  No data!")
            continue

        total_kwh = sum(float(r.get("kwh", 0)) for r in processed)
        revenue = sum(float(r.get("_revenue", 0)) for r in processed)
        electricity_est = total_kwh * 3
        org_rows = [r for r in processed if r.get("invoice_status") == "billed_to_organization"]
        personal_rows = [r for r in processed if r.get("invoice_status") != "billed_to_organization"]

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

        excel_bytes = build_report(rows=processed, location_name=loc_name, manual_inputs=manual_inputs)

        safe_name = loc_name.replace(" ", "_").replace("/", "_")[:50]
        filename = f"{safe_name}_2026-03.xlsx"
        output_path = os.path.join(OUTPUT_DIR, filename)
        with open(output_path, "wb") as f:
            f.write(excel_bytes.read())

        tx_fee = revenue * 0.0365
        total_fee = tx_fee + tx_fee * 0.07 + 30
        remaining = revenue - total_fee - electricity_est - 598 * 1.07 - 184 * 1.07
        gp_share = remaining * 0.40

        results.append({
            "location": loc_name,
            "total": len(processed),
            "fleet": len(org_rows),
            "personal": len(personal_rows),
            "kwh": round(total_kwh, 2),
            "revenue": round(revenue, 2),
            "gp_share": round(gp_share, 2),
            "filename": filename,
            "path": output_path,
        })
        print(f"  {len(processed)} rows ({len(org_rows)} fleet), rev={revenue:,.0f}, share={gp_share:,.0f}")

    # Build email
    total_rev = sum(r["revenue"] for r in results)
    total_gp = sum(r["gp_share"] for r in results)

    rows_html = ""
    for r in results:
        fleet_tag = f'<span style="background:#E3F0FF;color:#1565C0;padding:2px 6px;border-radius:4px;font-size:11px;">{r["fleet"]}</span>' if r["fleet"] > 0 else ""
        rows_html += (
            "<tr>"
            f'<td style="padding:7px 10px;border-bottom:1px solid #f0f0f0;font-size:13px;">{r["location"]}</td>'
            f'<td style="padding:7px 10px;border-bottom:1px solid #f0f0f0;text-align:center;font-size:13px;">{r["total"]}</td>'
            f'<td style="padding:7px 10px;border-bottom:1px solid #f0f0f0;text-align:center;font-size:13px;">{fleet_tag}</td>'
            f'<td style="padding:7px 10px;border-bottom:1px solid #f0f0f0;text-align:right;font-size:13px;">{r["kwh"]:,.0f}</td>'
            f'<td style="padding:7px 10px;border-bottom:1px solid #f0f0f0;text-align:right;font-size:13px;font-weight:600;">{r["revenue"]:,.2f}</td>'
            f'<td style="padding:7px 10px;border-bottom:1px solid #f0f0f0;text-align:right;font-size:13px;color:#6A1B9A;font-weight:600;">{r["gp_share"]:,.2f}</td>'
            "</tr>"
        )

    email_html = f"""
    <div style="font-family:'Inter',Arial,sans-serif;max-width:900px;margin:0 auto;">
        <div style="background:linear-gradient(135deg,#1a1a2e 0%,#16213e 100%);padding:28px 32px;border-radius:16px 16px 0 0;">
            <h1 style="color:white;margin:0;font-size:20px;font-weight:600;">Monthly Report - BYD & Bangchak</h1>
            <p style="color:rgba(255,255,255,0.6);margin:6px 0 0;font-size:13px;">March 2026 | Q#1141 V2 (with Fleet/Org + RFID)</p>
        </div>
        <div style="padding:28px 32px;border:1px solid #e8e8e8;border-top:none;border-radius:0 0 16px 16px;">
            <p style="color:#121212;font-size:14px;line-height:1.6;">
                Monthly reports for <strong>5 BYD</strong> and <strong>5 Bangchak</strong> top locations.
                New V2 format includes Organization name, RFID number, VIN columns, and
                <strong>billed_to_organization</strong> invoices with fleet data.
            </p>

            <table style="width:100%;border-collapse:separate;border-spacing:8px 0;margin:20px 0;">
                <tr>
                    <td style="background:#FDF2F3;border-radius:12px;padding:14px;text-align:center;">
                        <div style="color:#636E72;font-size:10px;text-transform:uppercase;">Total Revenue</div>
                        <div style="color:#8B1927;font-size:20px;font-weight:700;margin-top:2px;">{total_rev:,.0f}</div>
                        <div style="color:#636E72;font-size:10px;">THB</div>
                    </td>
                    <td style="background:#F3E5F5;border-radius:12px;padding:14px;text-align:center;">
                        <div style="color:#636E72;font-size:10px;text-transform:uppercase;">GP Share (40%)</div>
                        <div style="color:#6A1B9A;font-size:20px;font-weight:700;margin-top:2px;">{total_gp:,.0f}</div>
                        <div style="color:#636E72;font-size:10px;">THB</div>
                    </td>
                    <td style="background:#E3F0FF;border-radius:12px;padding:14px;text-align:center;">
                        <div style="color:#636E72;font-size:10px;text-transform:uppercase;">Locations</div>
                        <div style="color:#1565C0;font-size:20px;font-weight:700;margin-top:2px;">{len(results)}</div>
                        <div style="color:#636E72;font-size:10px;">stations</div>
                    </td>
                </tr>
            </table>

            <h3 style="font-size:14px;margin:24px 0 12px;color:#121212;">Station Breakdown</h3>
            <table style="width:100%;border-collapse:collapse;">
                <thead>
                    <tr style="background:#f8f9fa;">
                        <th style="padding:8px 10px;text-align:left;font-size:11px;color:#636E72;">Location</th>
                        <th style="padding:8px 10px;text-align:center;font-size:11px;color:#636E72;">Txns</th>
                        <th style="padding:8px 10px;text-align:center;font-size:11px;color:#636E72;">Fleet</th>
                        <th style="padding:8px 10px;text-align:right;font-size:11px;color:#636E72;">kWh</th>
                        <th style="padding:8px 10px;text-align:right;font-size:11px;color:#636E72;">Revenue</th>
                        <th style="padding:8px 10px;text-align:right;font-size:11px;color:#636E72;">GP Share</th>
                    </tr>
                </thead>
                <tbody>{rows_html}</tbody>
            </table>

            <p style="color:#636E72;font-size:12px;margin-top:20px;line-height:1.5;">
                <strong>Note:</strong> Electricity estimated at 3 THB/kWh. Fleet invoices (billed_to_organization)
                use invoice_amount as revenue. Each Excel has new VIN, RFID Number, and Organization columns.
            </p>

            <hr style="border:none;border-top:1px solid #e8e8e8;margin:24px 0;">
            <p style="color:#9CA3AF;font-size:11px;">Generated by Sharge Auto Report System<br>{datetime.now().strftime('%d %B %Y, %H:%M')}</p>
        </div>
    </div>
    """

    attachments = []
    for r in results:
        with open(r["path"], "rb") as f:
            attachments.append({"filename": r["filename"], "content": list(f.read())})

    print(f"\nSending email with {len(attachments)} attachments...")
    result = resend.Emails.send({
        "from": "Sharge Reports <onboarding@resend.dev>",
        "to": ["nattapong.p@shargemgmt.com"],
        "subject": f"Monthly Report - BYD & Bangchak (March 2026) | {len(results)} stations, {total_rev:,.0f} THB",
        "html": email_html,
        "attachments": attachments,
    })
    print(f"Email sent! ID: {result.get('id')}")


if __name__ == "__main__":
    asyncio.run(main())
