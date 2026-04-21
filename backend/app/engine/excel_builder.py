"""Build branded Excel report with Summary sheet + Data sheet + optional bill image."""

import os
from io import BytesIO
from datetime import datetime

from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.drawing.image import Image as XlImage
from openpyxl.utils import get_column_letter


# ── Styles ──
thin = Side(style="thin")
border_all = Border(left=thin, right=thin, top=thin, bottom=thin)
border_bottom = Border(bottom=thin)

font_header = Font(name="Calibri", size=11, bold=True)
font_data = Font(name="Calibri", size=11)
font_bold = Font(name="Calibri", size=11, bold=True)
font_bold_brown = Font(name="Calibri", size=11, bold=True, color="8B4513")
font_big_bold = Font(name="Calibri", size=13, bold=True)

fill_yellow = PatternFill(start_color="FFFF00", end_color="FFFF00", fill_type="solid")
fill_light_blue = PatternFill(start_color="DAEEF3", end_color="DAEEF3", fill_type="solid")
fill_light_green = PatternFill(start_color="C6EFCE", end_color="C6EFCE", fill_type="solid")
font_green = Font(name="Calibri", size=11, color="006100")

align_right = Alignment(horizontal="right")
align_center = Alignment(horizontal="center")
num_2dp = "#,##0.00"

REPORT_HEADERS = [
    "Invoice", "Reference Id", "Location", "Evse", "Start Date Time", "End Date Time",
    "Payment Created At", "Transaction Id", "Invoice Status", "Payment Amount",
    "Total Cost", "Total Discount", "Total Refund", "Unit Price\u00a0", "Kwh", "Total Time (Hour)",
    "Total Overtime (Hour)", "Etax Number", None,
    "Privilege Name", "Discount Label", "VIN",
    "RFID Number", "Organization",
]


def _parse_dt(s):
    if not s:
        return None
    try:
        return datetime.fromisoformat(str(s).replace("Z", "").replace("+00:00", ""))
    except Exception:
        return s


def _map_row(row_dict: dict) -> list:
    """Map processed row dict to Excel row.

    For credit privileges with share_rate:
      - Unit Price = share_rate
      - Total Discount = kwh * share_rate (recalculated)
      - Payment Amount = kwh * share_rate (= revenue)
    For percent privileges or no privilege:
      - Unit Price = invoice_amount / kwh
      - Total Discount = raw total_discount
      - Payment Amount = _revenue (calculated)
    """
    kwh = float(row_dict.get("kwh") or 0)
    invoice_amount = float(row_dict.get("invoice_amount") or 0)
    payment_amount = float(row_dict.get("payment_amount") or 0)
    raw_discount = float(row_dict.get("total_discount") or 0)
    revenue = float(row_dict.get("_revenue") or 0)
    share_rate = row_dict.get("_share_rate")
    priv_type = row_dict.get("_privilege_type")

    invoice_status = row_dict.get("invoice_status") or ""

    # billed_to_organization: use invoice_amount directly (org pays at their rate)
    if invoice_status == "billed_to_organization":
        unit_price = invoice_amount / kwh if kwh > 0 and invoice_amount > 0 else None
        return [
            row_dict.get("invoice_id"), row_dict.get("reference_id"),
            row_dict.get("location_name"), row_dict.get("evse_name"),
            _parse_dt(row_dict.get("session_start_bkk")), _parse_dt(row_dict.get("session_end_bkk")),
            _parse_dt(row_dict.get("paid_date_bkk")), row_dict.get("payment_transaction_id"),
            invoice_status, invoice_amount, invoice_amount, 0,
            float(row_dict.get("total_refund") or 0),
            unit_price, kwh,
            float(row_dict.get("total_time") or 0), float(row_dict.get("total_overtime") or 0),
            row_dict.get("etax_number"), None,
            row_dict.get("_display_name"),
            row_dict.get("discount_label") or "",
            row_dict.get("vin") or "", row_dict.get("rfid_number") or "",
            row_dict.get("organization_name") or "",
        ]

    # Determine if this is a credit row that needs recalculation
    is_credit_row = (priv_type == "credit") or \
                    (priv_type == "mixed" and payment_amount == 0) or \
                    (priv_type is None and payment_amount == 0 and raw_discount > 0)

    if is_credit_row and share_rate and share_rate > 0:
        # Recalculate with share_rate
        unit_price = share_rate
        total_discount = kwh * share_rate
        pay_amount = total_discount  # revenue = recalculated discount
    elif is_credit_row:
        # No share_rate: use raw total_discount as-is
        unit_price = raw_discount / kwh if kwh > 0 else None
        total_discount = raw_discount
        pay_amount = raw_discount
    else:
        # Normal / percent: use original values
        unit_price = invoice_amount / kwh if kwh > 0 and invoice_amount > 0 else None
        total_discount = raw_discount
        pay_amount = revenue

    return [
        row_dict.get("invoice_id"),
        row_dict.get("reference_id"),
        row_dict.get("location_name"),
        row_dict.get("evse_name"),
        _parse_dt(row_dict.get("session_start_bkk")),
        _parse_dt(row_dict.get("session_end_bkk")),
        _parse_dt(row_dict.get("paid_date_bkk")),
        row_dict.get("payment_transaction_id"),
        row_dict.get("invoice_status"),
        pay_amount,
        invoice_amount,
        total_discount,
        float(row_dict.get("total_refund") or 0),
        unit_price,
        kwh,
        float(row_dict.get("total_time") or 0),
        float(row_dict.get("total_overtime") or 0),
        row_dict.get("etax_number"),
        None,
        row_dict.get("_display_name"),
        row_dict.get("discount_label") or "",
        row_dict.get("vin") or "",
        row_dict.get("rfid_number") or "",
        row_dict.get("organization_name") or "",
    ]


def _write_summary_row(ws, row, label, desc, value, label_font=font_bold,
                       val_fill=None, val_font=None, blue_row=False, border=None):
    c_b = ws.cell(row=row, column=2, value=label)
    c_b.font = label_font
    c_b.alignment = align_right
    c_c = ws.cell(row=row, column=3, value=desc)
    c_c.alignment = align_center
    c_d = ws.cell(row=row, column=4, value=round(value, 2) if value is not None else None)
    c_d.number_format = num_2dp
    c_d.alignment = align_right
    if val_fill:
        c_d.fill = val_fill
    if val_font:
        c_d.font = val_font
    if blue_row:
        for c in (c_b, c_c, c_d):
            c.fill = fill_light_blue
            c.border = border_all
            c.font = font_bold_brown
    if border:
        c_d.border = border


def build_report(
    rows: list[dict],
    location_name: str,
    manual_inputs: dict,
    bill_image_path: str | None = None,
) -> BytesIO:
    """Build complete Excel report and return as BytesIO."""

    # ── Extract manual inputs ──
    electricity_cost = float(manual_inputs.get("electricity_cost", 0))
    internet_cost = float(manual_inputs.get("internet_cost", 0))
    etax = float(manual_inputs.get("etax", 0))
    tx_fee_rate = float(manual_inputs.get("transaction_fee_rate", 0.0365))
    vat_rate = float(manual_inputs.get("vat_rate", 0.07))
    location_share_rate = float(manual_inputs.get("location_share_rate", 0.40))
    date_start = manual_inputs.get("date_start", "")
    date_end = manual_inputs.get("date_end", "")

    # ── Calculate revenue using same logic as _map_row ──
    revenue = 0
    for r in rows:
        mapped = _map_row(r)
        revenue += float(mapped[9] or 0)  # column index 9 = Payment Amount
    tx_fee = revenue * tx_fee_rate
    vat_on_fee = tx_fee * vat_rate
    total_fee = tx_fee + vat_on_fee
    internet_incl_vat = internet_cost * (1 + vat_rate)
    etax_incl_vat = etax * (1 + vat_rate)
    remaining = revenue - total_fee - electricity_cost - internet_incl_vat - etax_incl_vat
    location_share = remaining * location_share_rate
    vat_portion = location_share - (location_share / (1 + vat_rate))
    before_vat = location_share / (1 + vat_rate)

    # Sort by paid_date
    rows.sort(key=lambda r: r.get("paid_date_bkk") or "")

    wb = Workbook()

    # ═══════════════════════════════════
    # Summary Sheet
    # ═══════════════════════════════════
    ws = wb.active
    ws.title = "Summary"
    ws.column_dimensions["A"].width = 3
    ws.column_dimensions["B"].width = 38
    ws.column_dimensions["C"].width = 38
    ws.column_dimensions["D"].width = 18

    # Revenue
    for col in (2, 3, 4):
        ws.cell(row=2, column=col).border = border_all
    ws.cell(row=2, column=2, value="Revenue").font = font_bold
    ws.cell(row=2, column=2).alignment = align_center
    ws.cell(row=2, column=4, value=round(revenue, 2)).font = font_bold
    ws.cell(row=2, column=4).number_format = num_2dp
    ws.cell(row=2, column=4).alignment = align_right

    # Fees
    _write_summary_row(ws, 4, "Transaction Fee", f"({tx_fee_rate*100:.2f}% of Revenue)", tx_fee)
    _write_summary_row(ws, 5, "VAT", f"({vat_rate*100:.0f}% of Transaction Fee)", vat_on_fee)
    _write_summary_row(ws, 6, "Total Fee", None, total_fee, border=border_bottom)

    # Costs
    _write_summary_row(ws, 8, "Electricity Cost", None, electricity_cost,
                       val_fill=fill_yellow, val_font=font_bold)
    _write_summary_row(ws, 9, "Internet Cost", None, internet_cost)
    _write_summary_row(ws, 10, None, "Vat 7%", internet_incl_vat)
    _write_summary_row(ws, 11, "Etax", None, etax)
    _write_summary_row(ws, 12, "Etax (Include Vat)", "Vat 7%", etax_incl_vat)
    _write_summary_row(ws, 13, "\u0e04\u0e07\u0e40\u0e2b\u0e25\u0e37\u0e2d", None, remaining,
                       val_font=font_bold, border=border_bottom)

    # Location share (blue)
    _write_summary_row(ws, 15, location_name,
                       f"({int(location_share_rate*100)}% of Total Revenue VAT Incl.)",
                       location_share, blue_row=True)
    _write_summary_row(ws, 16, "VAT", "(7% of Cash In)", vat_portion, blue_row=True)
    ws.cell(row=17, column=3, value="(Before VAT)").alignment = align_center
    ws.cell(row=17, column=4, value=round(before_vat, 2)).number_format = num_2dp
    ws.cell(row=17, column=4).alignment = align_right
    for c in (2, 3, 4):
        ws.cell(row=17, column=c).fill = fill_light_blue
        ws.cell(row=17, column=c).border = border_all
        ws.cell(row=17, column=c).font = font_bold_brown

    # Net GP
    ws.cell(row=19, column=2, value="Net GP").font = font_big_bold
    ws.cell(row=19, column=2).alignment = align_center
    ws.cell(row=19, column=3, value="(VAT Included)").font = font_bold
    ws.cell(row=19, column=3).alignment = align_center
    ws.cell(row=19, column=4, value=round(location_share, 2)).font = font_big_bold
    ws.cell(row=19, column=4).number_format = num_2dp
    ws.cell(row=19, column=4).alignment = align_right
    ws.cell(row=19, column=4).border = Border(top=Side(style="double"), bottom=Side(style="double"))

    # Bill image
    if bill_image_path and os.path.exists(bill_image_path):
        img = XlImage(bill_image_path)
        max_w = 500
        ratio = max_w / img.width if img.width > max_w else 1
        img.width = int(img.width * ratio)
        img.height = int(img.height * ratio)
        ws.add_image(img, "F2")

    # ═══════════════════════════════════
    # Data Sheet
    # ═══════════════════════════════════
    month_label = date_start[:7].replace("-", ".") if date_start else "data"
    ws_data = wb.create_sheet(month_label)

    for col_idx, h in enumerate(REPORT_HEADERS, 1):
        cell = ws_data.cell(row=1, column=col_idx, value=h)
        cell.font = font_header

    # Parse report month from date_start for cross-month detection
    report_month = None
    if date_start:
        try:
            report_month = datetime.fromisoformat(date_start).month
        except Exception:
            pass

    for row_num, row_dict in enumerate(rows, 2):
        mapped = _map_row(row_dict)
        for col_idx, val in enumerate(mapped, 1):
            cell = ws_data.cell(row=row_num, column=col_idx, value=val)
            cell.font = font_data
            if col_idx in (5, 6, 7) and isinstance(val, datetime):
                cell.number_format = "m/d/yy h:mm"
                # Highlight Start/End dates yellow if session is from different month
                if col_idx in (5, 6) and report_month and val.month != report_month:
                    cell.fill = fill_yellow
            elif col_idx == 10:
                cell.number_format = "0.00"
                cell.fill = fill_light_green
                cell.font = font_green
            elif col_idx in (11, 12, 13, 14, 15, 16, 18):
                cell.number_format = "0.00"

    # Auto-width
    for col_idx in range(1, len(REPORT_HEADERS) + 1):
        max_len = len(str(REPORT_HEADERS[col_idx - 1] or ""))
        for r in range(2, min(20, ws_data.max_row + 1)):
            val = ws_data.cell(row=r, column=col_idx).value
            max_len = max(max_len, min(len(str(val or "")), 40))
        ws_data.column_dimensions[get_column_letter(col_idx)].width = max_len + 2

    # ── Write to BytesIO ──
    output = BytesIO()
    wb.save(output)
    output.seek(0)
    return output
