"""Send report emails via SMTP (with Excel attachment + inline logo)."""

import logging
import smtplib
import ssl
from email.message import EmailMessage
from email.utils import make_msgid
from pathlib import Path

from app.config import settings

logger = logging.getLogger(__name__)

# Sharge logo bytes (loaded once). Attached inline via CID so Gmail/Outlook
# render it reliably — data: URIs are often stripped.
_LOGO_PATH = Path(__file__).resolve().parents[3] / "frontend" / "public" / "logo.png"
try:
    _LOGO_BYTES = _LOGO_PATH.read_bytes()
except FileNotFoundError:
    _LOGO_BYTES = b""

_LOGO_CID = "sharge-logo"


def _fmt(n: float | int | None, decimals: int = 2) -> str:
    if n is None:
        return "-"
    return f"{float(n):,.{decimals}f}"


def _render_summary_table(s: dict) -> str:
    """Render the revenue/GP breakdown as an HTML table (document style)."""
    if not s:
        return ""

    rev = s.get("revenue", 0) or 0
    tx_fee_rate = s.get("tx_fee_rate", 0.0365)
    vat_rate = s.get("vat_rate", 0.07)
    share_rate = s.get("location_share_rate", 0.40)

    def row(label, note, value, *, bold=False, highlight=False, accent=False, top=False):
        label_color = "#121212" if bold else "#121212"
        value_weight = "700" if bold else "500"
        bg = ""
        if highlight:
            bg = "background:#FFF8C5;"  # soft yellow for electricity
        if accent:
            bg = "background:#F5F5F5;"  # light grey for location share rows
        border_top = "border-top:2px solid #121212;" if top else ""
        return (
            f'<tr style="{border_top}">'
            f'<td style="padding:8px 10px; font-size:13px; color:{label_color}; font-weight:{value_weight}; {bg} border-bottom:1px solid #eee;">{label or ""}</td>'
            f'<td style="padding:8px 10px; font-size:12px; color:#636E72; {bg} border-bottom:1px solid #eee;">{note or ""}</td>'
            f'<td style="padding:8px 10px; font-size:13px; color:#121212; font-weight:{value_weight}; text-align:right; {bg} border-bottom:1px solid #eee; font-variant-numeric:tabular-nums;">{_fmt(value)}</td>'
            f"</tr>"
        )

    loc = s.get("location_name", "")

    html = f"""
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse; border:1px solid #121212; margin-top:8px;">
        <thead>
            <tr style="background:#121212; color:#ffffff;">
                <th style="padding:10px; text-align:left; font-size:11px; letter-spacing:1.5px; text-transform:uppercase; font-weight:600;">Item</th>
                <th style="padding:10px; text-align:left; font-size:11px; letter-spacing:1.5px; text-transform:uppercase; font-weight:600;">Note</th>
                <th style="padding:10px; text-align:right; font-size:11px; letter-spacing:1.5px; text-transform:uppercase; font-weight:600;">Amount (THB)</th>
            </tr>
        </thead>
        <tbody>
            {row("Revenue", "", rev, bold=True)}
            {row("Transaction Fee", f"({tx_fee_rate*100:.2f}% of Revenue)", s.get("tx_fee"))}
            {row("VAT", f"({vat_rate*100:.0f}% of Transaction Fee)", s.get("vat_on_fee"))}
            {row("Total Fee", "", s.get("total_fee"), bold=True)}
            {row("Electricity Cost", "", s.get("electricity_cost"), bold=True, highlight=True)}
            {row("Internet Cost", "", s.get("internet_cost"))}
            {row("Internet (Incl. VAT 7%)", "", s.get("internet_incl_vat"))}
            {row("Etax", "", s.get("etax"))}
            {row("Etax (Incl. VAT 7%)", "", s.get("etax_incl_vat"))}
            {row("คงเหลือ / Remaining", "", s.get("remaining"), bold=True, top=True)}
            {row(loc, f"({int(share_rate*100)}% of Total Revenue VAT Incl.)", s.get("location_share"), bold=True, accent=True, top=True)}
            {row("VAT", "(7% of Cash In)", s.get("vat_portion"), accent=True)}
            {row("Before VAT", "", s.get("before_vat"), accent=True)}
        </tbody>
        <tfoot>
            <tr style="background:#E30613; color:#ffffff;">
                <td style="padding:12px 10px; font-size:14px; font-weight:700; letter-spacing:0.5px;">Net GP</td>
                <td style="padding:12px 10px; font-size:12px; opacity:0.9;">(VAT Included)</td>
                <td style="padding:12px 10px; font-size:16px; font-weight:800; text-align:right; font-variant-numeric:tabular-nums;">{_fmt(s.get("location_share"))}</td>
            </tr>
        </tfoot>
    </table>
    """
    return html


def send_report_email(
    to: list[str],
    location_name: str,
    year_month: str,
    file_path: str,
    file_name: str,
    summary: dict | None = None,
) -> dict:
    """Send report email with Excel attachment over SMTP."""
    if not settings.smtp_host or not settings.smtp_from_email:
        logger.warning("SMTP not configured; skipping email to %s", to)
        return {"status": "skipped", "reason": "smtp_not_configured"}
    if not to:
        return {"status": "skipped", "reason": "no_recipients"}

    # Read attachment
    with open(file_path, "rb") as f:
        file_content = f.read()

    # Inject location_name for the summary table
    if summary is not None:
        summary = {**summary, "location_name": summary.get("location_name", location_name)}
    summary_table_html = _render_summary_table(summary) if summary else ""

    logo_cid_header = make_msgid(domain="sharge.local")
    logo_cid = logo_cid_header[1:-1]  # strip <>

    html_body = f"""
        <div style="font-family: 'Inter', Arial, sans-serif; max-width: 680px; margin: 0 auto; background: #ffffff; color: #121212;">
            <!-- Document header / brand bar -->
            <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse;">
                <tr>
                    <td style="background: #ffffff; padding: 20px 28px; border-top: 4px solid #E30613; border-bottom: 1px solid #121212;">
                        <table width="100%" cellpadding="0" cellspacing="0">
                            <tr>
                                <td style="vertical-align: middle;">
                                    <img src="cid:{logo_cid}" alt="Sharge" height="32" style="display:block; height:32px; width:auto; border:0; outline:none; text-decoration:none;">
                                    <div style="font-size: 10px; letter-spacing: 3px; color: #636E72; margin-top: 6px; text-transform: uppercase;">Monthly Performance Report</div>
                                </td>
                                <td style="vertical-align: middle; text-align: right; font-size: 11px; color: #636E72; text-transform: uppercase; letter-spacing: 1px;">
                                    Ref&nbsp;·&nbsp;{year_month}
                                </td>
                            </tr>
                        </table>
                    </td>
                </tr>
            </table>

            <!-- Document title -->
            <div style="padding: 28px 28px 8px 28px;">
                <div style="font-size: 11px; letter-spacing: 2px; color: #9CA3AF; text-transform: uppercase;">Report Summary</div>
                <h1 style="margin: 6px 0 0 0; font-size: 22px; font-weight: 700; color: #121212; letter-spacing: -0.3px;">
                    {location_name}
                </h1>
                <div style="font-size: 13px; color: #636E72; margin-top: 4px;">Period: {year_month}</div>
            </div>

            <!-- Divider -->
            <div style="height: 1px; background: #121212; margin: 20px 28px 0 28px;"></div>

            <!-- Body -->
            <div style="padding: 20px 28px 8px 28px;">
                <p style="font-size: 14px; line-height: 1.6; color: #121212; margin: 0 0 16px 0;">
                    Dear Team,
                </p>
                <p style="font-size: 14px; line-height: 1.6; color: #121212; margin: 0 0 16px 0;">
                    Please find attached the monthly performance report for <strong>{location_name}</strong>.
                    The document details revenue breakdown, energy delivered, transaction volume, and GP sharing
                    calculations for the period indicated below.
                </p>
            </div>

            <!-- Metadata table (document-style) -->
            <div style="padding: 0 28px;">
                <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; font-size: 13px; border-top: 1px solid #e8e8e8; border-bottom: 1px solid #e8e8e8;">
                    <tr>
                        <td style="padding: 10px 0; color: #636E72; width: 35%; border-bottom: 1px solid #f2f2f2;">Document Type</td>
                        <td style="padding: 10px 0; color: #121212; font-weight: 600; text-align: right; border-bottom: 1px solid #f2f2f2;">Monthly Revenue &amp; GP Report</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px 0; color: #636E72; border-bottom: 1px solid #f2f2f2;">Location</td>
                        <td style="padding: 10px 0; color: #121212; font-weight: 600; text-align: right; border-bottom: 1px solid #f2f2f2;">{location_name}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px 0; color: #636E72; border-bottom: 1px solid #f2f2f2;">Reporting Period</td>
                        <td style="padding: 10px 0; color: #121212; font-weight: 600; text-align: right; border-bottom: 1px solid #f2f2f2;">{year_month}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px 0; color: #636E72;">Attachment</td>
                        <td style="padding: 10px 0; color: #121212; font-weight: 600; text-align: right;">{file_name}</td>
                    </tr>
                </table>
            </div>

            <!-- Summary table -->
            <div style="padding: 16px 28px 8px 28px;">
                <div style="font-size: 11px; letter-spacing: 2px; color: #9CA3AF; text-transform: uppercase; margin-bottom: 8px;">Revenue &amp; GP Breakdown</div>
                {summary_table_html}
            </div>

            <!-- Notice -->
            <div style="padding: 20px 28px 8px 28px;">
                <div style="border-left: 3px solid #E30613; background: #FAFAFA; padding: 12px 14px; font-size: 13px; color: #121212; line-height: 1.55;">
                    The figures above mirror the <strong>Summary</strong> sheet in the attached Excel file.
                    Please refer to the attachment for transaction-level detail.
                </div>
            </div>

            <!-- Footer -->
            <div style="padding: 24px 28px 28px 28px;">
                <div style="border-top: 1px solid #121212; padding-top: 12px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                        <tr>
                            <td style="font-size: 11px; color: #636E72; letter-spacing: 0.5px;">
                                SHARGE MANAGEMENT · AUTO REPORT SYSTEM
                            </td>
                            <td style="font-size: 11px; color: #9CA3AF; text-align: right;">
                                Automated notification — do not reply
                            </td>
                        </tr>
                    </table>
                </div>
            </div>
        </div>
        """

    msg = EmailMessage()
    msg["From"] = settings.smtp_from_email
    msg["To"] = ", ".join(to)
    msg["Subject"] = f"Monthly Report - {location_name} ({year_month})"
    msg.set_content("Please view this email in an HTML-compatible client.")
    msg.add_alternative(html_body, subtype="html")

    # Inline logo (related part) — attach to the HTML alternative
    html_part = msg.get_payload()[-1]
    if _LOGO_BYTES:
        html_part.add_related(
            _LOGO_BYTES,
            maintype="image",
            subtype="png",
            cid=logo_cid_header,
            filename="sharge-logo.png",
        )

    # Excel attachment
    msg.add_attachment(
        file_content,
        maintype="application",
        subtype="vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        filename=file_name,
    )

    try:
        if settings.smtp_port == 465 and not settings.smtp_use_tls:
            # Implicit SSL
            context = ssl.create_default_context()
            with smtplib.SMTP_SSL(settings.smtp_host, settings.smtp_port, context=context, timeout=30) as s:
                if settings.smtp_user:
                    s.login(settings.smtp_user, settings.smtp_password)
                s.send_message(msg)
        else:
            # STARTTLS (587) or plain
            with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=30) as s:
                s.ehlo()
                if settings.smtp_use_tls:
                    s.starttls(context=ssl.create_default_context())
                    s.ehlo()
                if settings.smtp_user:
                    s.login(settings.smtp_user, settings.smtp_password)
                s.send_message(msg)
        logger.info("email sent to %s via %s", to, settings.smtp_host)
        return {"status": "sent"}
    except Exception as e:
        logger.warning("email send failed (%s): %s", to, e)
        return {"status": "error", "error": str(e)}
