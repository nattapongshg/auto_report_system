VAT_RATE = 0.07
TRANSFER_FEE = 30  # flat bank-transfer fee per invoice (THB, GP basis only)


def compute_totals(
    revenue: float,
    electricity: float,
    internet: float,
    etax: float,
    *,
    tx_fee_rate: float,
    share_rate: float,
    share_basis: str = 'gp',
) -> dict:
    tx_fee = revenue * tx_fee_rate
    vat_on_fee = tx_fee * VAT_RATE
    transfer = TRANSFER_FEE if share_basis != 'revenue' else 0
    total_fee = tx_fee + vat_on_fee + transfer
    internet_incl_vat = internet * (1 + VAT_RATE)
    etax_incl_vat = etax * (1 + VAT_RATE)

    if share_basis == 'revenue':
        # Revenue share: deduct only the fixed connectivity cost (internet),
        # leave transaction fee / electricity / etax out per business convention.
        remaining = revenue - internet_incl_vat
        location_share = remaining * share_rate
    else:
        remaining = revenue - total_fee - electricity - internet_incl_vat - etax_incl_vat
        location_share = remaining * share_rate

    before_vat = location_share / (1 + VAT_RATE)
    vat_portion = location_share - before_vat

    return {
        "tx_fee": tx_fee,
        "vat_on_fee": vat_on_fee,
        "transfer": transfer,
        "total_fee": total_fee,
        "internet_incl_vat": internet_incl_vat,
        "etax_incl_vat": etax_incl_vat,
        "remaining": remaining,
        "location_share": location_share,
        "before_vat": before_vat,
        "vat_portion": vat_portion,
    }
