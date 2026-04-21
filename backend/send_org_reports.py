"""Fetch Q#1141 data for April 1-7, find top 5 locations with org/fleet, generate reports, send email."""

import json
import os
import asyncio
from datetime import datetime, timedelta

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "output")
os.makedirs(OUTPUT_DIR, exist_ok=True)


async def main():
    from app.engine.fetcher import fetch_date_range
    from app.engine.privilege_calc import process_rows, refresh_cache
    from app.engine.excel_builder import build_report

    await refresh_cache()

    # Fetch April 1-7 from Q#1141 (new question with org+rfid)
    print("Fetching Q#1141 (April 1-7)...")
    raw_rows, col_names = await fetch_date_range(
        question_id=1141,
        date_start="2026-04-01",
        date_end="2026-04-07",
        on_progress=lambda msg: print(f"  {msg}"),
    )
    print(f"Total rows: {len(raw_rows)}, Columns: {col_names}")

    # Find top locations with org data
    org_idx = col_names.index("organization_name")
    loc_idx = col_names.index("location_name")
    rfid_idx = col_names.index("rfid_number")

    loc_stats = {}
    for r in raw_rows:
        org = r[org_idx]
        if not org:
            continue
        loc = r[loc_idx]
        if loc not in loc_stats:
            loc_stats[loc] = {"org": org, "count": 0, "rfids": set()}
        loc_stats[loc]["count"] += 1
        if r[rfid_idx]:
            loc_stats[loc]["rfids"].add(r[rfid_idx])

    top5 = sorted(loc_stats.items(), key=lambda x: -x[1]["count"])[:5]
    print(f"\nTop 5 locations with org fleet data:")
    for loc, info in top5:
        print(f"  {loc}: {info['count']} rows, org={info['org']}, {len(info['rfids'])} RFIDs")

    # Update excel headers to include new columns
    # We need to update _map_row to handle new columns
    # For now generate with existing builder + new columns visible

    import resend
    resend.api_key = "re_69RLVNxX_PjFVXqU8smhoH7gDNj96GrdE"

    results = []

    for loc_name, info in top5:
        print(f"\nProcessing: {loc_name}...")
        processed = await process_rows(raw_rows, col_names, loc_name)
        if not processed:
            continue

        total_kwh = sum(float(r.get("kwh", 0)) for r in processed)
        revenue = sum(float(r.get("_revenue", 0)) for r in processed)
        electricity_est = total_kwh * 3
        org_name = info["org"]
        org_rows = [r for r in processed if r.get("organization_name")]
        personal_rows = [r for r in processed if not r.get("organization_name")]

        manual_inputs = {
            "date_start": "2026-04-01",
            "date_end": "2026-04-07",
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
        filename = f"{safe_name}_2026-04-W1.xlsx"
        output_path = os.path.join(OUTPUT_DIR, filename)

        with open(output_path, "wb") as f:
            f.write(excel_bytes.read())

        # Calc GP
        tx_fee = revenue * 0.0365
        vat_on_fee = tx_fee * 0.07
        total_fee = tx_fee + vat_on_fee + 30
        internet_vat = 598 * 1.07
        etax_vat = 184 * 1.07
        remaining = revenue - total_fee - electricity_est - internet_vat - etax_vat
        gp_share = remaining * 0.40

        results.append({
            "location": loc_name,
            "org_name": org_name,
            "total_rows": len(processed),
            "org_rows": len(org_rows),
            "personal_rows": len(personal_rows),
            "rfid_count": len(info["rfids"]),
            "kwh": round(total_kwh, 2),
            "revenue": round(revenue, 2),
            "gp_share": round(gp_share, 2),
            "filename": filename,
            "path": output_path,
        })
        print(f"  {len(processed)} rows ({len(org_rows)} fleet + {len(personal_rows)} personal), rev={revenue:.0f}")

    # Build email
    rows_html = ""
    for r in results:
        rows_html += (
            "<tr>"
            f'<td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;font-size:13px;">{r["location"]}</td>'
            f'<td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;font-size:13px;">{r["org_name"]}</td>'
            f'<td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;text-align:center;font-size:13px;">{r["org_rows"]}</td>'
            f'<td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;text-align:center;font-size:13px;">{r["personal_rows"]}</td>'
            f'<td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;text-align:center;font-size:13px;">{r["rfid_count"]}</td>'
            f'<td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;text-align:right;font-size:13px;">{r["kwh"]:,.0f}</td>'
            f'<td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;text-align:right;font-size:13px;font-weight:600;">{r["revenue"]:,.2f}</td>'
            f'<td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;text-align:right;font-size:13px;color:#6A1B9A;font-weight:600;">{r["gp_share"]:,.2f}</td>'
            "</tr>"
        )

    total_rows = sum(r["total_rows"] for r in results)
    total_org = sum(r["org_rows"] for r in results)
    total_personal = sum(r["personal_rows"] for r in results)
    total_kwh = sum(r["kwh"] for r in results)
    total_rev = sum(r["revenue"] for r in results)
    total_gp = sum(r["gp_share"] for r in results)

    email_html = f"""
    <div style="font-family:'Inter',Arial,sans-serif;max-width:900px;margin:0 auto;">
        <div style="background:linear-gradient(135deg,#1a1a2e 0%,#16213e 100%);padding:28px 32px;border-radius:16px 16px 0 0;">
            <h1 style="color:white;margin:0;font-size:20px;font-weight:600;">Fleet & Organization Report</h1>
            <p style="color:rgba(255,255,255,0.6);margin:6px 0 0;font-size:13px;">Top 5 Locations with Fleet Data - April 1-7, 2026</p>
            <p style="color:rgba(255,255,255,0.4);margin:4px 0 0;font-size:11px;">Using Question #1141 (V2 with Fleet/Org + RFID)</p>
        </div>

        <div style="padding:28px 32px;border:1px solid #e8e8e8;border-top:none;border-radius:0 0 16px 16px;">
            <p style="color:#121212;font-size:14px;line-height:1.6;">
                Hi team,<br><br>
                Here are reports for the <strong>top 5 locations with fleet/organization transactions</strong>.
                The new report format includes:
            </p>
            <ul style="color:#636E72;font-size:13px;line-height:1.8;">
                <li><strong>Organization Name</strong> column for fleet invoices (status: billed_to_organization)</li>
                <li><strong>RFID Number</strong> column with visual card number (e.g. SHG000492)</li>
                <li><strong>VIN</strong> column for privilege vehicles</li>
                <li>Both <strong>personal</strong> (settled) and <strong>fleet</strong> (billed_to_organization) transactions</li>
            </ul>

            <!-- KPI Cards -->
            <table style="width:100%;border-collapse:separate;border-spacing:8px 0;margin:20px 0;">
                <tr>
                    <td style="background:#FDF2F3;border-radius:12px;padding:14px;text-align:center;">
                        <div style="color:#636E72;font-size:10px;text-transform:uppercase;">Total Revenue</div>
                        <div style="color:#8B1927;font-size:20px;font-weight:700;margin-top:2px;">{total_rev:,.0f}</div>
                        <div style="color:#636E72;font-size:10px;">THB</div>
                    </td>
                    <td style="background:#E8F8F0;border-radius:12px;padding:14px;text-align:center;">
                        <div style="color:#636E72;font-size:10px;text-transform:uppercase;">Fleet Txns</div>
                        <div style="color:#0B8457;font-size:20px;font-weight:700;margin-top:2px;">{total_org}</div>
                        <div style="color:#636E72;font-size:10px;">of {total_rows} total</div>
                    </td>
                    <td style="background:#E3F0FF;border-radius:12px;padding:14px;text-align:center;">
                        <div style="color:#636E72;font-size:10px;text-transform:uppercase;">Energy</div>
                        <div style="color:#1565C0;font-size:20px;font-weight:700;margin-top:2px;">{total_kwh:,.0f}</div>
                        <div style="color:#636E72;font-size:10px;">kWh</div>
                    </td>
                    <td style="background:#F3E5F5;border-radius:12px;padding:14px;text-align:center;">
                        <div style="color:#636E72;font-size:10px;text-transform:uppercase;">GP Share (40%)</div>
                        <div style="color:#6A1B9A;font-size:20px;font-weight:700;margin-top:2px;">{total_gp:,.0f}</div>
                        <div style="color:#636E72;font-size:10px;">THB</div>
                    </td>
                </tr>
            </table>

            <h3 style="font-size:14px;margin:24px 0 12px;color:#121212;">Station Breakdown</h3>
            <table style="width:100%;border-collapse:collapse;">
                <thead>
                    <tr style="background:#f8f9fa;">
                        <th style="padding:8px 12px;text-align:left;font-size:11px;color:#636E72;">Location</th>
                        <th style="padding:8px 12px;text-align:left;font-size:11px;color:#636E72;">Organization</th>
                        <th style="padding:8px 12px;text-align:center;font-size:11px;color:#636E72;">Fleet</th>
                        <th style="padding:8px 12px;text-align:center;font-size:11px;color:#636E72;">Personal</th>
                        <th style="padding:8px 12px;text-align:center;font-size:11px;color:#636E72;">RFIDs</th>
                        <th style="padding:8px 12px;text-align:right;font-size:11px;color:#636E72;">kWh</th>
                        <th style="padding:8px 12px;text-align:right;font-size:11px;color:#636E72;">Revenue</th>
                        <th style="padding:8px 12px;text-align:right;font-size:11px;color:#636E72;">GP Share</th>
                    </tr>
                </thead>
                <tbody>{rows_html}</tbody>
            </table>

            <p style="color:#636E72;font-size:12px;margin-top:20px;line-height:1.5;">
                <strong>Note:</strong> Electricity estimated at 3 THB/kWh. GP Share = 40% of (Revenue - Fees - Costs).
                Fleet invoices (billed_to_organization) use created_at date instead of settled_at.
            </p>

            <hr style="border:none;border-top:1px solid #e8e8e8;margin:24px 0;">
            <p style="color:#9CA3AF;font-size:11px;">
                Generated by Sharge Auto Report System (Q#1141 V2)<br>
                {datetime.now().strftime('%d %B %Y, %H:%M')}
            </p>
        </div>
    </div>
    """

    # Attach all 5 reports
    attachments = []
    for r in results:
        with open(r["path"], "rb") as f:
            attachments.append({"filename": r["filename"], "content": list(f.read())})

    print(f"\nSending email with {len(attachments)} attachments...")

    result = resend.Emails.send({
        "from": "Sharge Reports <onboarding@resend.dev>",
        "to": ["nattapong.p@shargemgmt.com"],
        "subject": f"Fleet Report - Top 5 Locations with Org Data (Apr 1-7) | {total_org} fleet txns, {total_rev:,.0f} THB",
        "html": email_html,
        "attachments": attachments,
    })

    print(f"Email sent! ID: {result.get('id')}")


if __name__ == "__main__":
    import resend
    asyncio.run(main())
