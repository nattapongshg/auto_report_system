# Data Schema: Sharge UAT

- Generated at: 2026-04-02 13:15:08 +07:00
- Base URL: https://metabase-dev.shargethailand.com
- Database ID: 33
- Engine: postgres
- DB Name: sharge_dev
- Host: sharge-dev-replica.cgidywwxzcmz.ap-southeast-1.rds.amazonaws.com
- Schema filter: public
- Table count: 90
- Field count: 1244

## Tables

### public.auth_attempts

- Table ID: 35
- Display name: Auth Attempts
- Entity type: entity/GenericTable
- Field count: 7
- Estimated row count: 0

| Column | DB Type | Base Type | Semantic Type | Required | Indexed | FK |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | type/UUID | type/PK | no | yes |  |
| created_at | timestamp | type/DateTime | type/CreationTimestamp | no | no |  |
| updated_at | timestamp | type/DateTime | type/UpdatedTimestamp | no | no |  |
| result | varchar | type/Text | type/Category | no | no |  |
| ip_address | varchar | type/Text |  | no | no |  |
| auth_type | varchar | type/Text | type/Category | yes | no |  |
| auth_value | varchar | type/Text | type/Email | yes | no |  |

### public.auth_penalties

- Table ID: 122
- Display name: Auth Penalties
- Entity type: entity/GenericTable
- Field count: 8
- Estimated row count: 0

| Column | DB Type | Base Type | Semantic Type | Required | Indexed | FK |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | type/UUID | type/PK | no | yes |  |
| created_at | timestamp | type/DateTime | type/CreationTimestamp | no | no |  |
| updated_at | timestamp | type/DateTime | type/UpdatedTimestamp | no | no |  |
| user_id | uuid | type/UUID | type/FK | yes | no | users.id |
| issued_at | timestamp | type/DateTime |  | yes | no |  |
| expires_at | timestamp | type/DateTime |  | no | no |  |
| scope | varchar | type/Text | type/Category | yes | no |  |
| revoked | bool | type/Boolean | type/Category | yes | no |  |

### public.auth_tokens

- Table ID: 54
- Display name: Auth Tokens
- Entity type: entity/GenericTable
- Field count: 9
- Estimated row count: 0

| Column | DB Type | Base Type | Semantic Type | Required | Indexed | FK |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | type/UUID | type/PK | no | yes |  |
| created_at | timestamp | type/DateTime | type/CreationTimestamp | no | no |  |
| updated_at | timestamp | type/DateTime | type/UpdatedTimestamp | no | no |  |
| token | varchar | type/Text |  | yes | yes |  |
| scope | varchar | type/Text | type/Category | yes | no |  |
| revoked | bool | type/Boolean | type/Category | yes | no |  |
| expires_in | int4 | type/Integer | type/Category | yes | no |  |
| user_id | uuid | type/UUID | type/FK | yes | no | users.id |
| verified | bool | type/Boolean | type/Category | yes | no |  |

### public.auto_charge_whitelists

- Table ID: 128
- Display name: Auto Charge Whitelists
- Entity type: entity/GenericTable
- Field count: 8
- Estimated row count: 0

| Column | DB Type | Base Type | Semantic Type | Required | Indexed | FK |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | type/UUID | type/PK | no | yes |  |
| created_at | timestamp | type/DateTime | type/CreationTimestamp | no | no |  |
| updated_at | timestamp | type/DateTime | type/UpdatedTimestamp | no | no |  |
| car_brand_id | uuid | type/UUID | type/FK | yes | no | car_brands.id |
| vin_prefixes | jsonb | type/JSON | type/SerializedJSON | yes | no |  |
| vid_prefixes | jsonb | type/JSON | type/SerializedJSON | yes | no |  |
| can_register | bool | type/Boolean | type/Category | yes | no |  |
| can_start | bool | type/Boolean | type/Category | yes | no |  |

### public.bookings

- Table ID: 44
- Display name: Bookings
- Entity type: entity/GenericTable
- Field count: 16
- Estimated row count: 0

| Column | DB Type | Base Type | Semantic Type | Required | Indexed | FK |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | type/UUID | type/PK | no | yes |  |
| created_at | timestamp | type/DateTime | type/CreationTimestamp | no | no |  |
| updated_at | timestamp | type/DateTime | type/UpdatedTimestamp | no | no |  |
| start_date_time | timestamp | type/DateTime | type/CreationTimestamp | no | no |  |
| end_date_time | timestamp | type/DateTime |  | no | no |  |
| events | jsonb | type/JSON | type/SerializedJSON | yes | no |  |
| user_id | uuid | type/UUID | type/FK | no | no | users.id |
| operator_id | uuid | type/UUID | type/FK | no | no | ocpi_operators.id |
| evse_id | uuid | type/UUID | type/FK | no | no | ocpi_evses.id |
| location_id | uuid | type/UUID | type/FK | no | no | ocpi_locations.id |
| car_model_id | uuid | type/UUID | type/FK | no | no | car_models.id |
| car_id | uuid | type/UUID | type/FK | no | no | cars.id |
| status | varchar | type/Text | type/Category | yes | yes |  |
| reservation_id | varchar | type/Text |  | no | no |  |
| country_code | varchar | type/Text | type/Country | no | yes |  |
| party_id | varchar | type/Text | type/Category | no | no |  |

### public.car_brands

- Table ID: 84
- Display name: Car Brands
- Entity type: entity/GenericTable
- Field count: 5
- Estimated row count: 0

| Column | DB Type | Base Type | Semantic Type | Required | Indexed | FK |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | type/UUID | type/PK | no | yes |  |
| created_at | timestamp | type/DateTime | type/CreationTimestamp | no | no |  |
| updated_at | timestamp | type/DateTime | type/UpdatedTimestamp | no | no |  |
| brand_name | varchar | type/Text | type/Category | yes | no |  |
| brand_icon | varchar | type/Text | type/URL | yes | no |  |

### public.car_models

- Table ID: 60
- Display name: Car Models
- Entity type: entity/GenericTable
- Field count: 7
- Estimated row count: 0

| Column | DB Type | Base Type | Semantic Type | Required | Indexed | FK |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | type/UUID | type/PK | no | yes |  |
| created_at | timestamp | type/DateTime | type/CreationTimestamp | no | no |  |
| updated_at | timestamp | type/DateTime | type/UpdatedTimestamp | no | no |  |
| model_name | varchar | type/Text |  | yes | no |  |
| additional_data | jsonb | type/JSON | type/SerializedJSON | yes | no |  |
| battery_kilowatt_hour | numeric | type/Decimal |  | yes | no |  |
| brand_id | uuid | type/UUID | type/FK | no | no | car_brands.id |

### public.cars

- Table ID: 39
- Display name: Cars
- Entity type: entity/GenericTable
- Field count: 12
- Estimated row count: 0

| Column | DB Type | Base Type | Semantic Type | Required | Indexed | FK |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | type/UUID | type/PK | no | yes |  |
| created_at | timestamp | type/DateTime | type/CreationTimestamp | no | no |  |
| updated_at | timestamp | type/DateTime | type/UpdatedTimestamp | no | no |  |
| is_default | bool | type/Boolean | type/Category | yes | no |  |
| vin | varchar | type/Text |  | no | no |  |
| deleted_at | timestamp | type/DateTime | type/DeletionTimestamp | no | no |  |
| user_id | uuid | type/UUID | type/FK | no | no | users.id |
| car_model_id | uuid | type/UUID | type/FK | no | no | car_models.id |
| vid | varchar | type/Text |  | no | no |  |
| is_auto_charge_enabled | bool | type/Boolean | type/Category | yes | no |  |
| license_plate_number | varchar | type/Text | type/Category | no | no |  |
| license_plate_region | varchar | type/Text |  | no | no |  |

### public.countries

- Table ID: 87
- Display name: Countries
- Entity type: entity/GenericTable
- Field count: 9
- Estimated row count: 0

| Column | DB Type | Base Type | Semantic Type | Required | Indexed | FK |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | type/UUID | type/PK | no | yes |  |
| created_at | timestamp | type/DateTime | type/CreationTimestamp | no | no |  |
| updated_at | timestamp | type/DateTime | type/UpdatedTimestamp | no | no |  |
| name | varchar | type/Text | type/Name | no | no |  |
| calling_code | varchar | type/Text |  | no | no |  |
| document_code | varchar | type/Text |  | no | no |  |
| flag_icon | varchar | type/Text | type/URL | no | no |  |
| sort_order | int4 | type/Integer | type/Category | no | no |  |
| enable | bool | type/Boolean | type/Category | no | no |  |

### public.customer_groups

- Table ID: 59
- Display name: Customer Groups
- Entity type: entity/GenericTable
- Field count: 12
- Estimated row count: 0

| Column | DB Type | Base Type | Semantic Type | Required | Indexed | FK |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | type/UUID | type/PK | no | yes |  |
| metadata → earn → points_per_baht | double precision | type/Number | type/Category | no | no |  |
| metadata → location_icon | text | type/Text | type/Category | no | no |  |
| metadata → spend → min_points_needed | bigint | type/Integer | type/Category | no | no |  |
| metadata → spend → points_per_baht | bigint | type/Integer | type/Category | no | no |  |
| created_at | timestamp | type/DateTime | type/CreationTimestamp | no | no |  |
| updated_at | timestamp | type/DateTime | type/UpdatedTimestamp | no | no |  |
| name | varchar | type/Text | type/Name | no | no |  |
| metadata | jsonb | type/JSON | type/SerializedJSON | no | no |  |
| privilege_program_id | uuid | type/UUID | type/FK | no | no | privilege_programs.id |
| slug | varchar | type/Text |  | yes | yes |  |
| is_applicable_to_all_locations | bool | type/Boolean | type/Category | yes | no |  |

### public.devices

- Table ID: 69
- Display name: Devices
- Entity type: entity/GenericTable
- Field count: 18
- Estimated row count: 0

| Column | DB Type | Base Type | Semantic Type | Required | Indexed | FK |
| --- | --- | --- | --- | --- | --- | --- |
| attributes → accept_language | text | type/Text | type/Category | no | no |  |
| attributes → app_id | text | type/Text | type/Category | no | no |  |
| attributes → app_version | text | type/Text | type/Category | no | no |  |
| attributes → device_platform | text | type/Text | type/Category | no | no |  |
| attributes → device_uuid | text | type/Text | type/Category | no | no |  |
| attributes → device_version | text | type/Text | type/Category | no | no |  |
| attributes → last_ip | text | type/Text | type/Category | no | no |  |
| attributes → user_agent | text | type/Text | type/Category | no | no |  |
| id | uuid | type/UUID | type/PK | no | yes |  |
| created_at | timestamp | type/DateTime | type/CreationTimestamp | no | no |  |
| updated_at | timestamp | type/DateTime | type/UpdatedTimestamp | no | no |  |
| current_user_id | uuid | type/UUID | type/FK | no | yes | users.id |
| platform | varchar | type/Text | type/Category | no | no |  |
| app_id | varchar | type/Text | type/Category | yes | yes |  |
| unique_identifier | varchar | type/Text |  | yes | no |  |
| attributes | jsonb | type/JSON | type/SerializedJSON | no | no |  |
| push_enabled | bool | type/Boolean | type/Category | yes | no |  |
| push_token | varchar | type/Text |  | no | no |  |

### public.etax_documents

- Table ID: 111
- Display name: Etax Documents
- Entity type: entity/GenericTable
- Field count: 33
- Estimated row count: 0

| Column | DB Type | Base Type | Semantic Type | Required | Indexed | FK |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | type/UUID | type/PK | no | yes |  |
| created_at | timestamp | type/DateTime | type/CreationTimestamp | no | no |  |
| updated_at | timestamp | type/DateTime | type/UpdatedTimestamp | no | no |  |
| document_type_no | varchar | type/Text | type/Category | yes | no |  |
| invoice_number | varchar | type/Text |  | yes | yes |  |
| seller_tax_id | varchar | type/Text | type/Category | yes | no |  |
| seller_branch_code | varchar | type/Text | type/Category | yes | no |  |
| buyer_type | varchar | type/Text | type/Category | yes | no |  |
| buyer_tax_id | varchar | type/Text | type/Category | yes | no |  |
| buyer_name | varchar | type/Text | type/Category | yes | no |  |
| buyer_branch_code | varchar | type/Text | type/Category | no | no |  |
| buyer_email | varchar | type/Text | type/Email | no | no |  |
| buyer_zipcode | varchar | type/Text | type/Category | yes | no |  |
| buyer_country | varchar | type/Text | type/Country | yes | no |  |
| buyer_address | varchar | type/Text | type/Category | yes | no |  |
| buyer_province | varchar | type/Text | type/Category | no | no |  |
| buyer_district | varchar | type/Text | type/Category | no | no |  |
| buyer_sub_district | varchar | type/Text | type/Category | no | no |  |
| currency | varchar | type/Text | type/Category | yes | no |  |
| tax_code_type | varchar | type/Text | type/Category | yes | no |  |
| tax_rate | numeric | type/Decimal | type/Share | yes | no |  |
| total_amount | numeric | type/Decimal |  | yes | no |  |
| document_reference | varchar | type/Text | type/Category | no | no |  |
| document_reference_date | timestamp | type/DateTime |  | no | no |  |
| document_reference_code | varchar | type/Text | type/Category | no | no |  |
| document_reason | varchar | type/Text | type/Category | no | no |  |
| document_reason_code | varchar | type/Text | type/Category | no | no |  |
| product_ids | jsonb | type/JSON | type/SerializedJSON | yes | no |  |
| status | varchar | type/Text | type/Category | yes | no |  |
| transaction_reference | varchar | type/Text | type/Category | yes | no |  |
| export_date | timestamp | type/DateTime |  | yes | no |  |
| etax_status | varchar | type/Text | type/Category | no | no |  |
| note | varchar | type/Text | type/Category | no | no |  |

### public.etax_invoice_numbers

- Table ID: 113
- Display name: Etax Invoice Numbers
- Entity type: entity/GenericTable
- Field count: 8
- Estimated row count: 0

| Column | DB Type | Base Type | Semantic Type | Required | Indexed | FK |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | type/UUID | type/PK | no | yes |  |
| created_at | timestamp | type/DateTime | type/CreationTimestamp | no | no |  |
| updated_at | timestamp | type/DateTime | type/UpdatedTimestamp | no | no |  |
| document_type_no | varchar | type/Text | type/Category | yes | yes |  |
| year | int4 | type/Integer | type/Category | yes | no |  |
| month | int4 | type/Integer | type/Category | yes | no |  |
| current_number | int4 | type/Integer | type/Quantity | yes | no |  |
| source_type | varchar | type/Text | type/Category | yes | no |  |

### public.etax_products

- Table ID: 107
- Display name: Etax Products
- Entity type: entity/ProductTable
- Field count: 9
- Estimated row count: 0

| Column | DB Type | Base Type | Semantic Type | Required | Indexed | FK |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | type/UUID | type/PK | no | yes |  |
| created_at | timestamp | type/DateTime | type/CreationTimestamp | no | no |  |
| updated_at | timestamp | type/DateTime | type/UpdatedTimestamp | no | no |  |
| description | varchar | type/Text | type/Description | yes | no |  |
| unit_code | varchar | type/Text | type/Category | yes | no |  |
| additional1 | varchar | type/Text | type/Category | no | no |  |
| additional2 | varchar | type/Text | type/Category | no | no |  |
| additional3 | varchar | type/Text | type/Category | no | no |  |
| price | numeric | type/Decimal |  | yes | no |  |

### public.etax_queue

- Table ID: 55
- Display name: Etax Queue
- Entity type: entity/GenericTable
- Field count: 7
- Estimated row count: 0

| Column | DB Type | Base Type | Semantic Type | Required | Indexed | FK |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | type/UUID | type/PK | no | yes |  |
| created_at | timestamp | type/DateTime | type/CreationTimestamp | no | no |  |
| updated_at | timestamp | type/DateTime | type/UpdatedTimestamp | no | no |  |
| status | varchar | type/Text | type/Category | yes | no |  |
| processed_at | timestamp | type/DateTime |  | no | no |  |
| issued_for_type | varchar | type/Text | type/Category | yes | no |  |
| issued_for_id | varchar | type/Text |  | yes | no |  |

### public.evse_groups

- Table ID: 42
- Display name: Evse Groups
- Entity type: entity/GenericTable
- Field count: 4
- Estimated row count: 0

| Column | DB Type | Base Type | Semantic Type | Required | Indexed | FK |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | type/UUID | type/PK | no | yes |  |
| created_at | timestamp | type/DateTime | type/CreationTimestamp | no | no |  |
| updated_at | timestamp | type/DateTime | type/UpdatedTimestamp | no | no |  |
| name | varchar | type/Text | type/Name | yes | yes |  |

### public.evse_groups_customer_groups

- Table ID: 91
- Display name: Evse Groups Customer Groups
- Entity type: entity/GenericTable
- Field count: 2
- Estimated row count: 0

| Column | DB Type | Base Type | Semantic Type | Required | Indexed | FK |
| --- | --- | --- | --- | --- | --- | --- |
| evse_group_id | uuid | type/UUID | type/FK | yes | yes | evse_groups.id |
| customer_group_id | uuid | type/UUID | type/FK | yes | yes | customer_groups.id |

### public.evses_groups

- Table ID: 50
- Display name: Evses Groups
- Entity type: entity/GenericTable
- Field count: 2
- Estimated row count: 0

| Column | DB Type | Base Type | Semantic Type | Required | Indexed | FK |
| --- | --- | --- | --- | --- | --- | --- |
| evse_id | uuid | type/UUID | type/FK | yes | yes | ocpi_evses.id |
| evse_group_id | uuid | type/UUID | type/FK | yes | yes | evse_groups.id |

### public.evses_groups_organizations

- Table ID: 110
- Display name: Evses Groups Organizations
- Entity type: entity/GenericTable
- Field count: 2
- Estimated row count: 0

| Column | DB Type | Base Type | Semantic Type | Required | Indexed | FK |
| --- | --- | --- | --- | --- | --- | --- |
| evse_group_id | uuid | type/UUID | type/FK | yes | yes | evse_groups.id |
| organization_id | uuid | type/UUID | type/FK | yes | yes | organizations.id |

### public.geography_columns

- Table ID: 40
- Display name: Geography Columns
- Entity type: entity/GenericTable
- Field count: 7

| Column | DB Type | Base Type | Semantic Type | Required | Indexed | FK |
| --- | --- | --- | --- | --- | --- | --- |
| f_table_catalog | name | type/* |  | no | no |  |
| f_table_schema | name | type/* |  | no | no |  |
| f_table_name | name | type/* |  | no | no |  |
| f_geography_column | name | type/* |  | no | no |  |
| coord_dimension | int4 | type/Integer |  | no | no |  |
| srid | int4 | type/Integer | type/Category | no | no |  |
| type | text | type/Text | type/Category | no | no |  |

### public.geometry_columns

- Table ID: 88
- Display name: Geometry Columns
- Entity type: entity/GenericTable
- Field count: 7

| Column | DB Type | Base Type | Semantic Type | Required | Indexed | FK |
| --- | --- | --- | --- | --- | --- | --- |
| f_table_catalog | varchar | type/Text |  | no | no |  |
| f_table_schema | name | type/* |  | no | no |  |
| f_table_name | name | type/* |  | no | no |  |
| f_geometry_column | name | type/* |  | no | no |  |
| coord_dimension | int4 | type/Integer |  | no | no |  |
| srid | int4 | type/Integer |  | no | no |  |
| type | varchar | type/Text |  | no | no |  |

### public.id_tag_permissions

- Table ID: 117
- Display name: ID Tag Permissions
- Entity type: entity/GenericTable
- Field count: 8
- Estimated row count: 0

| Column | DB Type | Base Type | Semantic Type | Required | Indexed | FK |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | type/UUID | type/PK | no | yes |  |
| created_at | timestamp | type/DateTime | type/CreationTimestamp | no | no |  |
| updated_at | timestamp | type/DateTime | type/UpdatedTimestamp | no | no |  |
| id_tag | varchar | type/Text | type/Category | yes | yes |  |
| can_auto_charge | bool | type/Boolean | type/Category | yes | no |  |
| can_rfid_start | bool | type/Boolean | type/Category | yes | no |  |
| can_remote_start | bool | type/Boolean | type/Category | yes | no |  |
| remark | varchar | type/Text | type/Category | no | no |  |

### public.invoice_refund_requests

- Table ID: 105
- Display name: Invoice Refund Requests
- Entity type: entity/GenericTable
- Field count: 14
- Estimated row count: 0

| Column | DB Type | Base Type | Semantic Type | Required | Indexed | FK |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | type/UUID | type/PK | no | yes |  |
| created_at | timestamp | type/DateTime | type/CreationTimestamp | no | no |  |
| updated_at | timestamp | type/DateTime | type/UpdatedTimestamp | no | no |  |
| user_id | uuid | type/UUID | type/FK | yes | no | users.id |
| invoice_id | uuid | type/UUID | type/FK | yes | yes | invoices.id |
| full_name | varchar | type/Text | type/Name | yes | no |  |
| phone_number | varchar | type/Text | type/Category | yes | no |  |
| reason | varchar | type/Text | type/Category | yes | no |  |
| details | varchar | type/Text | type/Category | yes | no |  |
| status | varchar | type/Text | type/Category | yes | no |  |
| events | jsonb | type/JSON | type/SerializedJSON | no | no |  |
| processed_by_admin_id | uuid | type/UUID | type/FK | no | no | users.id |
| processed_at | timestamp | type/DateTime |  | no | no |  |
| remarks | varchar | type/Text |  | no | no |  |

### public.invoices

- Table ID: 94
- Display name: Invoices
- Entity type: entity/GenericTable
- Field count: 27
- Estimated row count: 0

| Column | DB Type | Base Type | Semantic Type | Required | Indexed | FK |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | type/UUID | type/PK | no | yes |  |
| created_at | timestamp | type/DateTime | type/CreationTimestamp | no | yes |  |
| updated_at | timestamp | type/DateTime | type/UpdatedTimestamp | no | no |  |
| status | varchar | type/Text | type/Category | yes | yes |  |
| total_discount_satang | int4 | type/Integer | type/Discount | yes | no |  |
| user_id | uuid | type/UUID | type/FK | no | yes | users.id |
| total_cost_satang | int4 | type/Integer | type/Cost | yes | no |  |
| subtotal_satang | int4 | type/Integer |  | yes | no |  |
| total_satang | int4 | type/Integer |  | yes | no |  |
| total_vat_satang | int4 | type/Integer |  | yes | no |  |
| minimum_fee_satang | int4 | type/Integer |  | yes | no |  |
| vat_percentage | numeric | type/Decimal | type/Share | no | no |  |
| invoice_number | varchar | type/Text |  | yes | yes |  |
| etax_status | varchar | type/Text | type/Category | no | no |  |
| currency | varchar | type/Text | type/Category | yes | no |  |
| roaming_fee_percentage | numeric | type/Decimal | type/Share | no | no |  |
| roaming_fee_satang | int4 | type/Integer |  | no | no |  |
| rewards | jsonb | type/JSON | type/SerializedJSON | no | no |  |
| discounts | jsonb | type/JSON | type/SerializedJSON | no | no |  |
| reminder_sent_at | timestamp | type/DateTime |  | no | no |  |
| auto_billing_processed_at | timestamp | type/DateTime |  | no | no |  |
| organization_id | uuid | type/UUID | type/FK | no | yes | organizations.id |
| settled_at | timestamp | type/DateTime |  | no | no |  |
| total_refund_satang | int4 | type/Integer |  | no | no |  |
| etax_document_type_no | varchar | type/Text | type/Category | no | no |  |
| version | int4 | type/Integer | type/Category | yes | no |  |
| organization_invoice_id | uuid | type/UUID | type/FK | no | no | organization_invoices.id |

### public.kbank_auth_tokens

- Table ID: 58
- Display name: Kbank Auth Tokens
- Entity type: entity/GenericTable
- Field count: 5
- Estimated row count: 0

| Column | DB Type | Base Type | Semantic Type | Required | Indexed | FK |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | type/UUID | type/PK | no | yes |  |
| created_at | timestamp | type/DateTime | type/CreationTimestamp | no | no |  |
| updated_at | timestamp | type/DateTime | type/UpdatedTimestamp | no | no |  |
| client_id | varchar | type/Text | type/Category | yes | yes |  |
| access_token | varchar | type/Text | type/Category | yes | no |  |

### public.membership_cards

- Table ID: 81
- Display name: Membership Cards
- Entity type: entity/GenericTable
- Field count: 10
- Estimated row count: 0

| Column | DB Type | Base Type | Semantic Type | Required | Indexed | FK |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | type/UUID | type/PK | no | yes |  |
| created_at | timestamp | type/DateTime | type/CreationTimestamp | no | no |  |
| updated_at | timestamp | type/DateTime | type/UpdatedTimestamp | no | no |  |
| name | varchar | type/Text | type/Name | no | no |  |
| redeem_point_conversion_point | int4 | type/Integer | type/Category | no | no |  |
| redeem_point_conversion_baht | int4 | type/Integer | type/Category | no | no |  |
| earn_point_conversion_point | int4 | type/Integer | type/Category | no | no |  |
| earn_point_conversion_baht | int4 | type/Integer | type/Category | no | no |  |
| discount_start_baht | int4 | type/Integer | type/Discount | no | no |  |
| discount_increase_by_range_baht | int4 | type/Integer | type/Discount | no | no |  |

### public.membership_rewards

- Table ID: 93
- Display name: Membership Rewards
- Entity type: entity/GenericTable
- Field count: 9
- Estimated row count: 0

| Column | DB Type | Base Type | Semantic Type | Required | Indexed | FK |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | type/UUID | type/PK | no | yes |  |
| created_at | timestamp | type/DateTime | type/CreationTimestamp | no | no |  |
| updated_at | timestamp | type/DateTime | type/UpdatedTimestamp | no | no |  |
| member_card_type | varchar | type/Text | type/Category | yes | no |  |
| first_name | varchar | type/Text | type/Name | yes | no |  |
| last_name | varchar | type/Text | type/Name | yes | no |  |
| card_no | varchar | type/Text |  | yes | no |  |
| total_point | int4 | type/Integer |  | yes | no |  |
| user_id | uuid | type/UUID | type/FK | no | no | users.id |

### public.migrations

- Table ID: 90
- Display name: Migrations
- Entity type: entity/GenericTable
- Field count: 3
- Estimated row count: 0

| Column | DB Type | Base Type | Semantic Type | Required | Indexed | FK |
| --- | --- | --- | --- | --- | --- | --- |
| id | serial | type/Integer | type/PK | no | yes |  |
| timestamp | int8 | type/BigInteger |  | yes | no |  |
| name | varchar | type/Text | type/Name | yes | no |  |

### public.notification_templates

- Table ID: 82
- Display name: Notification Templates
- Entity type: entity/GenericTable
- Field count: 10
- Estimated row count: 0

| Column | DB Type | Base Type | Semantic Type | Required | Indexed | FK |
| --- | --- | --- | --- | --- | --- | --- |
| description → en | text | type/Text | type/Description | no | no |  |
| description → th | text | type/Text | type/Description | no | no |  |
| id | uuid | type/UUID | type/PK | no | yes |  |
| title → en | text | type/Text | type/Title | no | no |  |
| title → th | text | type/Text | type/Title | no | no |  |
| created_at | timestamp | type/DateTime | type/CreationTimestamp | no | no |  |
| updated_at | timestamp | type/DateTime | type/UpdatedTimestamp | no | no |  |
| type | varchar | type/Text | type/Category | no | no |  |
| title | jsonb | type/JSON | type/SerializedJSON | no | no |  |
| description | jsonb | type/JSON | type/SerializedJSON | no | no |  |

### public.notifications

- Table ID: 73
- Display name: Notifications
- Entity type: entity/GenericTable
- Field count: 10
- Estimated row count: 0

| Column | DB Type | Base Type | Semantic Type | Required | Indexed | FK |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | type/UUID | type/PK | no | yes |  |
| created_at | timestamp | type/DateTime | type/CreationTimestamp | no | no |  |
| updated_at | timestamp | type/DateTime | type/UpdatedTimestamp | no | no |  |
| title_en | varchar | type/Text | type/Title | yes | no |  |
| title_th | varchar | type/Text | type/Title | yes | no |  |
| description_en | varchar | type/Text | type/Description | no | no |  |
| description_th | varchar | type/Text | type/Description | no | no |  |
| type | varchar | type/Text | type/Category | yes | no |  |
| is_read | bool | type/Boolean | type/Category | yes | no |  |
| user_id | uuid | type/UUID | type/FK | no | yes | users.id |

### public.ocpi_cdrs

- Table ID: 78
- Display name: Ocpi Cdrs
- Entity type: entity/GenericTable
- Field count: 79
- Estimated row count: 0

| Column | DB Type | Base Type | Semantic Type | Required | Indexed | FK |
| --- | --- | --- | --- | --- | --- | --- |
| cdr_location → address | text | type/Text |  | no | no |  |
| cdr_location → city | text | type/Text |  | no | no |  |
| cdr_location → connector_format | text | type/Text | type/Category | no | no |  |
| cdr_location → connector_id | text | type/Text |  | no | no |  |
| cdr_location → connector_power_type | text | type/Text | type/Category | no | no |  |
| cdr_location → connector_standard | text | type/Text | type/Category | no | no |  |
| cdr_location → coordinates → latitude | text | type/Text |  | no | no |  |
| cdr_location → coordinates → longitude | text | type/Text |  | no | no |  |
| cdr_location → country | text | type/Text |  | no | no |  |
| cdr_location → evse_id | text | type/Text |  | no | no |  |
| cdr_location → evse_uid | text | type/Text |  | no | no |  |
| cdr_location → id | text | type/Text |  | no | no |  |
| cdr_location → name | text | type/Text |  | no | no |  |
| cdr_location → postal_code | text | type/Text |  | no | no |  |
| cdr_location → state | text | type/Text | type/State | no | no |  |
| cdr_location → time_zone | text | type/Text |  | no | no |  |
| cdr_token → contract_id | text | type/Text | type/Category | no | no |  |
| cdr_token → country_code | text | type/Text | type/Category | no | no |  |
| cdr_token → created_at | timestamp | type/DateTime | type/CreationTimestamp | no | no |  |
| cdr_token → id | text | type/Text |  | no | no |  |
| cdr_token → id_tag | text | type/Text |  | no | no |  |
| cdr_token → issuer | text | type/Text | type/Category | no | no |  |
| cdr_token → language | text | type/Text | type/Category | no | no |  |
| cdr_token → last_updated | timestamp | type/DateTime | type/UpdatedTimestamp | no | no |  |
| cdr_token → party_id | text | type/Text | type/Category | no | no |  |
| cdr_token → type | text | type/Text | type/Category | no | no |  |
| cdr_token → uid | text | type/Text |  | no | no |  |
| cdr_token → user_id | text | type/Text |  | no | no |  |
| cdr_token → valid | boolean | type/Boolean | type/Category | no | no |  |
| cdr_token → whitelist | text | type/Text | type/Category | no | no |  |
| id | uuid | type/UUID | type/PK | no | yes |  |
| total_booking_cost → excl_vat | double precision | type/Float | type/Cost | no | no |  |
| total_booking_cost → incl_vat | double precision | type/Number | type/Cost | no | no |  |
| total_cost → excl_vat | double precision | type/Number | type/Cost | no | no |  |
| total_cost → incl_vat | double precision | type/Number | type/Cost | no | no |  |
| total_energy_cost → excl_vat | double precision | type/Number | type/Cost | no | no |  |
| total_energy_cost → incl_vat | double precision | type/Number | type/Cost | no | no |  |
| total_fixed_cost → excl_vat | bigint | type/Integer | type/Cost | no | no |  |
| total_fixed_cost → incl_vat | bigint | type/Integer | type/Cost | no | no |  |
| total_overtime_cost → excl_vat | double precision | type/Float | type/Cost | no | no |  |
| total_overtime_cost → incl_vat | double precision | type/Float | type/Cost | no | no |  |
| total_parking_cost → excl_vat | double precision | type/Number | type/Cost | no | no |  |
| total_parking_cost → incl_vat | double precision | type/Number | type/Cost | no | no |  |
| total_time_cost → excl_vat | double precision | type/Number | type/Cost | no | no |  |
| total_time_cost → incl_vat | double precision | type/Number | type/Cost | no | no |  |
| created_at | timestamp | type/DateTime | type/CreationTimestamp | no | yes |  |
| last_updated | timestamp | type/DateTime | type/UpdatedTimestamp | no | no |  |
| country_code | varchar | type/Text | type/Country | yes | no |  |
| party_id | varchar | type/Text | type/Category | yes | no |  |
| start_date_time | timestamp | type/DateTime | type/CreationTimestamp | yes | no |  |
| end_date_time | timestamp | type/DateTime |  | yes | no |  |
| session_id | uuid | type/UUID | type/FK | yes | yes | ocpi_sessions.id |
| meter_id | varchar | type/Text |  | no | no |  |
| currency | varchar | type/Text | type/Category | yes | no |  |
| signed_data | jsonb | type/JSON | type/SerializedJSON | no | no |  |
| total_cost | jsonb | type/JSON | type/SerializedJSON | yes | no |  |
| total_fixed_cost | jsonb | type/JSON | type/SerializedJSON | no | no |  |
| total_energy | numeric | type/Decimal |  | yes | no |  |
| total_energy_cost | jsonb | type/JSON | type/SerializedJSON | no | no |  |
| total_time | numeric | type/Decimal |  | yes | no |  |
| total_time_cost | jsonb | type/JSON | type/SerializedJSON | no | no |  |
| total_parking_time | numeric | type/Decimal |  | no | no |  |
| total_parking_cost | jsonb | type/JSON | type/SerializedJSON | no | no |  |
| total_reservation_cost | jsonb | type/JSON | type/SerializedJSON | no | no |  |
| remark | varchar | type/Text |  | no | no |  |
| credit | bool | type/Boolean | type/Category | no | no |  |
| credit_reference_id | varchar | type/Text |  | no | no |  |
| home_charging_compensation | bool | type/Boolean | type/Category | no | no |  |
| invoice_id | uuid | type/UUID | type/FK | no | yes | invoices.id |
| total_overtime | numeric | type/Decimal |  | no | no |  |
| total_overtime_cost | jsonb | type/JSON | type/SerializedJSON | no | no |  |
| uid | varchar | type/Text |  | yes | yes |  |
| auth_method | varchar | type/Text | type/Category | yes | no |  |
| authorization_reference | varchar | type/Text | type/Author | no | no |  |
| cdr_location | jsonb | type/JSON | type/SerializedJSON | yes | no |  |
| cdr_token | jsonb | type/JSON | type/SerializedJSON | no | no |  |
| invoice_reference_id | varchar | type/Text |  | no | no |  |
| total_booking_time | numeric | type/Decimal |  | no | no |  |
| total_booking_cost | jsonb | type/JSON | type/SerializedJSON | no | no |  |

### public.ocpi_cdrs_tariffs

- Table ID: 37
- Display name: Ocpi Cdrs Tariffs
- Entity type: entity/GenericTable
- Field count: 2
- Estimated row count: 0

| Column | DB Type | Base Type | Semantic Type | Required | Indexed | FK |
| --- | --- | --- | --- | --- | --- | --- |
| tariff_id | uuid | type/UUID | type/FK | yes | yes | ocpi_tariffs.id |
| cdr_id | uuid | type/UUID | type/FK | yes | yes | ocpi_cdrs.id |

### public.ocpi_charging_periods

- Table ID: 46
- Display name: Ocpi Charging Periods
- Entity type: entity/GenericTable
- Field count: 8
- Estimated row count: 0

| Column | DB Type | Base Type | Semantic Type | Required | Indexed | FK |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | type/UUID | type/PK | no | yes |  |
| created_at | timestamp | type/DateTime | type/CreationTimestamp | no | no |  |
| last_updated | timestamp | type/DateTime | type/UpdatedTimestamp | no | no |  |
| start_date_time | timestamp | type/DateTime | type/CreationTimestamp | yes | no |  |
| dimensions | jsonb | type/JSON | type/SerializedJSON | yes | no |  |
| session_id | uuid | type/UUID | type/FK | no | yes | ocpi_sessions.id |
| tariff_id | uuid | type/UUID | type/FK | no | yes | ocpi_tariffs.id |
| cdr_id | uuid | type/UUID | type/FK | no | yes | ocpi_cdrs.id |

### public.ocpi_commands

- Table ID: 100
- Display name: Ocpi Commands
- Entity type: entity/GenericTable
- Field count: 39
- Estimated row count: 0

| Column | DB Type | Base Type | Semantic Type | Required | Indexed | FK |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | type/UUID | type/PK | no | yes |  |
| payload → authorization_reference | text | type/Text | type/Author | no | no |  |
| payload → connector_id | text | type/Text | type/Category | no | no |  |
| payload → evse_uid | text | type/Text | type/Category | no | no |  |
| payload → expiry_date | timestamp | type/DateTime |  | no | no |  |
| payload → location_id | text | type/Text | type/Category | no | no |  |
| payload → reservation_id | text | type/Text | type/Category | no | no |  |
| payload → response_url | text | type/Text | type/URL | no | no |  |
| payload → session_id | text | type/Text | type/Category | no | no |  |
| payload → start_date | timestamp | type/DateTime | type/CreationTimestamp | no | no |  |
| payload → token → contract_id | text | type/Text | type/Category | no | no |  |
| payload → token → country_code | text | type/Text | type/Category | no | no |  |
| payload → token → created_at | timestamp | type/DateTime | type/CreationTimestamp | no | no |  |
| payload → token → energy_contract → contract_id | text | type/Text | type/Category | no | no |  |
| payload → token → energy_contract → supplier_name | text | type/Text | type/Category | no | no |  |
| payload → token → id | text | type/Text | type/Category | no | no |  |
| payload → token → id_tag | text | type/Text | type/Category | no | no |  |
| payload → token → issuer | text | type/Text | type/Category | no | no |  |
| payload → token → last_updated | timestamp | type/DateTime | type/UpdatedTimestamp | no | no |  |
| payload → token → party_id | text | type/Text | type/Category | no | no |  |
| payload → token → type | text | type/Text | type/Category | no | no |  |
| payload → token → uid | text | type/Text | type/Category | no | no |  |
| payload → token → valid | boolean | type/Boolean | type/Category | no | no |  |
| payload → token → whitelist | text | type/Text | type/Category | no | no |  |
| payload → token_uid | text | type/Text | type/Category | no | no |  |
| response → message | text | type/Array |  | no | no |  |
| response → request_token | text | type/Text |  | no | no |  |
| response → result | text | type/Text | type/Category | no | no |  |
| response → timeout | bigint | type/Integer | type/Category | no | no |  |
| result → message | text | type/Array |  | no | no |  |
| result → result | text | type/Text | type/Category | no | no |  |
| created_at | timestamp | type/DateTime | type/CreationTimestamp | no | no |  |
| last_updated | timestamp | type/DateTime | type/UpdatedTimestamp | no | no |  |
| evse_id | uuid | type/UUID | type/FK | no | no | ocpi_evses.id |
| type | varchar | type/Text | type/Category | yes | no |  |
| result | jsonb | type/JSON | type/SerializedJSON | no | no |  |
| response | jsonb | type/JSON | type/SerializedJSON | no | no |  |
| result_token | varchar | type/Text |  | no | yes |  |
| payload | jsonb | type/JSON | type/SerializedJSON | no | no |  |

### public.ocpi_connectors

- Table ID: 83
- Display name: Ocpi Connectors
- Entity type: entity/GenericTable
- Field count: 15
- Estimated row count: 0

| Column | DB Type | Base Type | Semantic Type | Required | Indexed | FK |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | type/UUID | type/PK | no | yes |  |
| created_at | timestamp | type/DateTime | type/CreationTimestamp | no | no |  |
| last_updated | timestamp | type/DateTime | type/UpdatedTimestamp | no | no |  |
| standard | varchar | type/Text | type/Category | yes | no |  |
| format | varchar | type/Text | type/Category | yes | no |  |
| power_type | varchar | type/Text | type/Category | yes | no |  |
| max_voltage | int4 | type/Integer |  | yes | no |  |
| max_amperage | int4 | type/Integer |  | yes | no |  |
| max_electric_power | int4 | type/Integer |  | no | no |  |
| terms_and_conditions | varchar | type/Text | type/Category | no | no |  |
| connector_id | int4 | type/Integer | type/Category | no | no |  |
| evse_id | uuid | type/UUID | type/FK | yes | yes | ocpi_evses.id |
| efficiency | numeric | type/Decimal |  | no | no |  |
| uid | varchar | type/Text |  | yes | no |  |
| min_electric_power | int4 | type/Integer | type/Category | no | no |  |

### public.ocpi_connectors_tariffs

- Table ID: 76
- Display name: Ocpi Connectors Tariffs
- Entity type: entity/GenericTable
- Field count: 2
- Estimated row count: 0

| Column | DB Type | Base Type | Semantic Type | Required | Indexed | FK |
| --- | --- | --- | --- | --- | --- | --- |
| connector_id | uuid | type/UUID | type/FK | yes | yes | ocpi_connectors.id |
| tariff_id | uuid | type/UUID | type/FK | yes | yes | ocpi_tariffs.id |

### public.ocpi_credentials

- Table ID: 74
- Display name: Ocpi Credentials
- Entity type: entity/GenericTable
- Field count: 13
- Estimated row count: 0

| Column | DB Type | Base Type | Semantic Type | Required | Indexed | FK |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | type/UUID | type/PK | no | yes |  |
| created_at | timestamp | type/DateTime | type/CreationTimestamp | no | no |  |
| last_updated | timestamp | type/DateTime | type/UpdatedTimestamp | no | no |  |
| country_code | varchar | type/Text | type/Country | yes | no |  |
| party_id | varchar | type/Text | type/Category | yes | no |  |
| server_token | varchar | type/Text | type/Category | yes | yes |  |
| client_token | varchar | type/Text | type/Category | no | no |  |
| server_token_type | varchar | type/Text | type/Category | yes | no |  |
| roles | jsonb | type/JSON | type/SerializedJSON | no | no |  |
| url | varchar | type/Text | type/URL | no | no |  |
| version | varchar | type/Text |  | no | no |  |
| endpoints | jsonb | type/JSON | type/SerializedJSON | no | no |  |
| data_synced_at | timestamp | type/DateTime |  | no | no |  |

### public.ocpi_event_queue

- Table ID: 48
- Display name: Ocpi Event Queue
- Entity type: entity/GenericTable
- Field count: 95
- Estimated row count: 0

| Column | DB Type | Base Type | Semantic Type | Required | Indexed | FK |
| --- | --- | --- | --- | --- | --- | --- |
| headers → ocpi-to-country-code | text | type/Text |  | no | no |  |
| headers → ocpi-to-party-id | text | type/Text |  | no | no |  |
| headers → x-correlation-id | text | type/Text |  | no | no |  |
| id | uuid | type/UUID | type/PK | no | yes |  |
| payload → auth_method | text | type/Text | type/Category | no | no |  |
| payload → authorization_reference | text | type/Text | type/Author | no | no |  |
| payload → cdr_location → address | text | type/Text | type/Category | no | no |  |
| payload → cdr_location → city | text | type/Text | type/Category | no | no |  |
| payload → cdr_location → connector_format | text | type/Text | type/Category | no | no |  |
| payload → cdr_location → connector_id | text | type/Text | type/Category | no | no |  |
| payload → cdr_location → connector_power_type | text | type/Text | type/Category | no | no |  |
| payload → cdr_location → connector_standard | text | type/Text | type/Category | no | no |  |
| payload → cdr_location → coordinates → latitude | text | type/Text | type/Category | no | no |  |
| payload → cdr_location → coordinates → longitude | text | type/Text | type/Category | no | no |  |
| payload → cdr_location → country | text | type/Text | type/Category | no | no |  |
| payload → cdr_location → evse_id | text | type/Text | type/Category | no | no |  |
| payload → cdr_location → evse_uid | text | type/Text | type/Category | no | no |  |
| payload → cdr_location → id | text | type/Text | type/Category | no | no |  |
| payload → cdr_location → name | text | type/Text | type/Category | no | no |  |
| payload → cdr_location → postal_code | text | type/Text | type/Category | no | no |  |
| payload → cdr_location → state | text | type/Text |  | no | no |  |
| payload → cdr_token → contract_id | text | type/Text | type/Category | no | no |  |
| payload → cdr_token → country_code | text | type/Text | type/Category | no | no |  |
| payload → cdr_token → party_id | text | type/Text | type/Category | no | no |  |
| payload → cdr_token → type | text | type/Text | type/Category | no | no |  |
| payload → cdr_token → uid | text | type/Text | type/Category | no | no |  |
| payload → charging_periods | text | type/Array |  | no | no |  |
| payload → connector_id | text | type/Text | type/Category | no | no |  |
| payload → country_code | text | type/Text | type/Category | no | no |  |
| payload → created_at | timestamp | type/DateTime | type/CreationTimestamp | no | no |  |
| payload → currency | text | type/Text | type/Category | no | no |  |
| payload → end_date_time | timestamp | type/DateTime |  | no | no |  |
| payload → evse_id | text | type/Text | type/Category | no | no |  |
| payload → evse_uid | text | type/Text |  | no | no |  |
| payload → id | text | type/Text | type/Category | no | no |  |
| payload → invoice_reference_id | text | type/Text | type/Category | no | no |  |
| payload → kwh | double precision | type/Number |  | no | no |  |
| payload → last_updated | timestamp | type/DateTime | type/UpdatedTimestamp | no | no |  |
| payload → location_id | text | type/Text | type/Category | no | no |  |
| payload → party_id | text | type/Text | type/Category | no | no |  |
| payload → payload → authorization_reference | text | type/Text | type/Author | no | no |  |
| payload → payload → connector_id | text | type/Text | type/Category | no | no |  |
| payload → payload → evse_uid | text | type/Text | type/Category | no | no |  |
| payload → payload → expiry_date | timestamp | type/DateTime |  | no | no |  |
| payload → payload → location_id | text | type/Text | type/Category | no | no |  |
| payload → payload → reservation_id | text | type/Text | type/Category | no | no |  |
| payload → payload → response_url | text | type/Text | type/URL | no | no |  |
| payload → payload → session_id | text | type/Text | type/Category | no | no |  |
| payload → payload → start_date | timestamp | type/DateTime | type/CreationTimestamp | no | no |  |
| payload → payload → token → contract_id | text | type/Text | type/Category | no | no |  |
| payload → payload → token → country_code | text | type/Text | type/Category | no | no |  |
| payload → payload → token → created_at | timestamp | type/DateTime | type/CreationTimestamp | no | no |  |
| payload → payload → token → energy_contract → contract_id | text | type/Text | type/Category | no | no |  |
| payload → payload → token → energy_contract → supplier_name | text | type/Text | type/Category | no | no |  |
| payload → payload → token → id | text | type/Text | type/Category | no | no |  |
| payload → payload → token → id_tag | text | type/Text | type/Category | no | no |  |
| payload → payload → token → issuer | text | type/Text | type/Category | no | no |  |
| payload → payload → token → last_updated | timestamp | type/DateTime | type/UpdatedTimestamp | no | no |  |
| payload → payload → token → party_id | text | type/Text | type/Category | no | no |  |
| payload → payload → token → type | text | type/Text | type/Category | no | no |  |
| payload → payload → token → uid | text | type/Text | type/Category | no | no |  |
| payload → payload → token → valid | boolean | type/Boolean | type/Category | no | no |  |
| payload → payload → token → whitelist | text | type/Text | type/Category | no | no |  |
| payload → payload → token_uid | text | type/Text |  | no | no |  |
| payload → response → message | text | type/Array |  | no | no |  |
| payload → response → result | text | type/Text | type/Category | no | no |  |
| payload → response → timeout | bigint | type/Integer | type/Category | no | no |  |
| payload → result → result | text | type/Text | type/Category | no | no |  |
| payload → result_token | text | type/Text | type/Category | no | no |  |
| payload → session_id | text | type/Text | type/Category | no | no |  |
| payload → start_date_time | timestamp | type/DateTime | type/CreationTimestamp | no | no |  |
| payload → status | text | type/Text | type/Category | no | no |  |
| payload → tariffs | text | type/Array |  | no | no |  |
| payload → total_cost → excl_vat | double precision | type/Number | type/Cost | no | no |  |
| payload → total_cost → incl_vat | double precision | type/Number | type/Cost | no | no |  |
| payload → total_energy | double precision | type/Number |  | no | no |  |
| payload → total_energy_cost → excl_vat | double precision | type/Float | type/Cost | no | no |  |
| payload → total_energy_cost → incl_vat | double precision | type/Float | type/Cost | no | no |  |
| payload → total_fixed_cost → excl_vat | bigint | type/Integer | type/Cost | no | no |  |
| payload → total_fixed_cost → incl_vat | bigint | type/Integer | type/Cost | no | no |  |
| payload → total_parking_time | bigint | type/Integer | type/Category | no | no |  |
| payload → total_time | double precision | type/Float |  | no | no |  |
| payload → total_time_cost → excl_vat | bigint | type/Integer |  | no | no |  |
| payload → total_time_cost → incl_vat | bigint | type/Integer | type/Cost | no | no |  |
| payload → type | text | type/Text | type/Category | no | no |  |
| created_at | timestamp | type/DateTime | type/CreationTimestamp | no | yes |  |
| last_updated | timestamp | type/DateTime | type/UpdatedTimestamp | no | no |  |
| country_code | varchar | type/Text | type/Country | yes | no |  |
| party_id | varchar | type/Text | type/Category | yes | no |  |
| http_method | varchar | type/Text | type/Category | yes | no |  |
| payload | jsonb | type/JSON | type/SerializedJSON | yes | no |  |
| status | varchar | type/Text | type/Category | yes | no |  |
| processed_at | timestamp | type/DateTime |  | no | no |  |
| module | varchar | type/Text | type/Category | yes | no |  |
| headers | jsonb | type/JSON | type/SerializedJSON | yes | no |  |

### public.ocpi_evses

- Table ID: 33
- Display name: Ocpi Evses
- Entity type: entity/GenericTable
- Field count: 23
- Estimated row count: 0

| Column | DB Type | Base Type | Semantic Type | Required | Indexed | FK |
| --- | --- | --- | --- | --- | --- | --- |
| coordinates → latitude | text | type/Text | type/Category | no | no |  |
| coordinates → longitude | text | type/Text | type/Category | no | no |  |
| id | uuid | type/UUID | type/PK | no | yes |  |
| created_at | timestamp | type/DateTime | type/CreationTimestamp | no | no |  |
| last_updated | timestamp | type/DateTime | type/UpdatedTimestamp | no | no |  |
| name | text | type/Text | type/Name | no | no |  |
| physical_reference | varchar | type/Text |  | no | no |  |
| identifier | varchar | type/Text |  | no | yes |  |
| is_enabled | bool | type/Boolean | type/Category | no | no |  |
| location_id | uuid | type/UUID | type/FK | yes | yes | ocpi_locations.id |
| status | varchar | type/Text | type/Category | yes | no |  |
| brand | varchar | type/Text | type/Category | no | no |  |
| supports_multi_connector | bool | type/Boolean | type/Category | yes | no |  |
| uid | varchar | type/Text |  | yes | no |  |
| evse_id | varchar | type/Text | type/Category | no | no |  |
| status_schedule | jsonb | type/JSON | type/SerializedJSON | no | no |  |
| capabilities | jsonb | type/JSON | type/SerializedJSON | no | no |  |
| floor_level | varchar | type/Text |  | no | no |  |
| directions | jsonb | type/JSON | type/SerializedJSON | no | no |  |
| parking_restrictions | jsonb | type/JSON | type/SerializedJSON | no | no |  |
| images | jsonb | type/JSON | type/SerializedJSON | no | no |  |
| coordinates | jsonb | type/JSON | type/SerializedJSON | no | no |  |
| has_parking_bay | bool | type/Boolean | type/Category | no | no |  |

### public.ocpi_locations

- Table ID: 41
- Display name: Ocpi Locations
- Entity type: entity/GenericTable
- Field count: 73
- Estimated row count: 0

| Column | DB Type | Base Type | Semantic Type | Required | Indexed | FK |
| --- | --- | --- | --- | --- | --- | --- |
| coordinates → latitude | text | type/Text |  | no | no |  |
| coordinates → longitude | text | type/Text |  | no | no |  |
| icons → rechargeapp | text | type/Text | type/URL | no | no |  |
| icons → shargeapp | text | type/Text | type/URL | no | no |  |
| id | uuid | type/UUID | type/PK | no | yes |  |
| opening_times → regular_hours | text | type/Array |  | no | no |  |
| opening_times → twentyfourseven | boolean | type/Boolean | type/Category | no | no |  |
| created_at | timestamp | type/DateTime | type/CreationTimestamp | no | yes |  |
| last_updated | timestamp | type/DateTime | type/UpdatedTimestamp | no | no |  |
| name | varchar | type/Text | type/Name | yes | no |  |
| name_th | varchar | type/Text |  | no | no |  |
| icon | varchar | type/Text | type/URL | no | no |  |
| station_code | varchar | type/Text |  | no | no |  |
| email | varchar | type/Text | type/Category | no | no |  |
| phone | varchar | type/Text | type/Category | no | no |  |
| address | varchar | type/Text |  | yes | no |  |
| city | varchar | type/Text | type/City | yes | no |  |
| postal_code | varchar | type/Text | type/ZipCode | no | no |  |
| free | bool | type/Boolean | type/Category | no | no |  |
| price | int4 | type/Integer |  | no | no |  |
| public | bool | type/Boolean | type/Category | no | no |  |
| enable_overtime | bool | type/Boolean | type/Category | no | no |  |
| overtime_price | int4 | type/Integer |  | no | no |  |
| reservation_time_start | int4 | type/Integer | type/Category | no | no |  |
| reservation_time_end | int4 | type/Integer | type/Category | no | no |  |
| pickup_notification_time | int4 | type/Integer |  | no | no |  |
| auto_cancel_booking | int4 | type/Integer |  | no | no |  |
| auto_checkout_booking | int4 | type/Integer |  | no | no |  |
| remind_check_in | int4 | type/Integer |  | no | no |  |
| remind_check_out | int4 | type/Integer |  | no | no |  |
| remind_cancel | int4 | type/Integer |  | no | no |  |
| early_checkin_time | int4 | type/Integer |  | no | no |  |
| images | jsonb | type/JSON | type/SerializedJSON | no | no |  |
| point_of_interest | varchar | type/Text | type/Category | no | no |  |
| opening_hours_start | int4 | type/Integer | type/Category | no | no |  |
| opening_hours_end | int4 | type/Integer | type/Category | no | no |  |
| additional_details | varchar | type/Text | type/Category | no | no |  |
| operator_id | uuid | type/UUID | type/FK | no | no | ocpi_operators.id |
| kwh_price | numeric | type/Decimal |  | no | no |  |
| kwh_peak_price | numeric | type/Decimal |  | no | no |  |
| status | varchar | type/Text | type/Category | no | no |  |
| location_type | varchar | type/Text | type/Category | no | no |  |
| max_booking_hours | int4 | type/Integer | type/Category | no | no |  |
| idle_price | int4 | type/Integer |  | no | no |  |
| no_show_price | int4 | type/Integer |  | no | no |  |
| issue_tax_invoice_type | varchar | type/Text | type/Category | no | no |  |
| branch_code | varchar | type/Text |  | no | no |  |
| requires_booking | bool | type/Boolean | type/Category | no | no |  |
| lp_station_id | int4 | type/Integer | type/Category | no | no |  |
| party_id | varchar | type/Text | type/Category | yes | no |  |
| state | varchar | type/Text | type/State | no | no |  |
| country | varchar | type/Text | type/Country | yes | no |  |
| country_code | varchar | type/Text | type/Country | yes | no |  |
| uid | varchar | type/Text |  | yes | yes |  |
| suboperator_id | uuid | type/UUID | type/FK | no | no | ocpi_operators.id |
| owner_id | uuid | type/UUID | type/FK | no | no | ocpi_operators.id |
| publish_allowed_to | jsonb | type/JSON | type/SerializedJSON | no | no |  |
| related_locations | jsonb | type/JSON | type/SerializedJSON | no | no |  |
| parking_type | jsonb | type/JSON | type/SerializedJSON | no | no |  |
| directions | jsonb | type/JSON | type/SerializedJSON | no | no |  |
| facilities | jsonb | type/JSON | type/SerializedJSON | no | no |  |
| time_zone | varchar | type/Text | type/Category | yes | no |  |
| opening_times | jsonb | type/JSON | type/SerializedJSON | no | no |  |
| charging_when_closed | bool | type/Boolean | type/Category | no | no |  |
| energy_mix | bool | type/Boolean | type/Category | no | no |  |
| publish | bool | type/Boolean | type/Category | yes | no |  |
| coordinates | jsonb | type/JSON | type/SerializedJSON | yes | no |  |
| vat_percentage | numeric | type/Decimal | type/Share | no | no |  |
| place_ids | jsonb | type/JSON | type/SerializedJSON | no | no |  |
| notice | varchar | type/Text | type/Category | no | no |  |
| icons | jsonb | type/JSON | type/SerializedJSON | yes | no |  |
| geom | geography | type/* |  | no | yes |  |
| energy_allocation_mode | varchar | type/Text | type/Category | no | no |  |

### public.ocpi_locations_opening_times_templates

- Table ID: 114
- Display name: Ocpi Locations Opening Times Templates
- Entity type: entity/GenericTable
- Field count: 3
- Estimated row count: 0

| Column | DB Type | Base Type | Semantic Type | Required | Indexed | FK |
| --- | --- | --- | --- | --- | --- | --- |
| location_id | uuid | type/UUID | type/FK | yes | yes | ocpi_locations.id |
| template_id | uuid | type/UUID | type/FK | yes | yes | ocpi_opening_times_templates.id |
| sort_order | int4 | type/Integer | type/Category | yes | no |  |

### public.ocpi_opening_times_templates

- Table ID: 115
- Display name: Ocpi Opening Times Templates
- Entity type: entity/GenericTable
- Field count: 10
- Estimated row count: 0

| Column | DB Type | Base Type | Semantic Type | Required | Indexed | FK |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | type/UUID | type/PK | no | yes |  |
| schedule → dailyPeriods | text | type/Array |  | no | no |  |
| schedule → twentyFourSeven | boolean | type/Boolean | type/Category | no | no |  |
| created_at | timestamp | type/DateTime | type/CreationTimestamp | no | no |  |
| updated_at | timestamp | type/DateTime | type/UpdatedTimestamp | no | no |  |
| name | varchar | type/Text | type/Name | yes | no |  |
| type | varchar | type/Text | type/Category | yes | no |  |
| override_mode | varchar | type/Text | type/Category | no | no |  |
| schedule | jsonb | type/JSON | type/SerializedJSON | no | no |  |
| exception_days | jsonb | type/JSON | type/SerializedJSON | no | no |  |

### public.ocpi_operators

- Table ID: 62
- Display name: Ocpi Operators
- Entity type: entity/GenericTable
- Field count: 19
- Estimated row count: 0

| Column | DB Type | Base Type | Semantic Type | Required | Indexed | FK |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | type/UUID | type/PK | no | yes |  |
| created_at | timestamp | type/DateTime | type/CreationTimestamp | no | no |  |
| last_updated | timestamp | type/DateTime | type/UpdatedTimestamp | no | no |  |
| name | varchar | type/Text | type/Name | yes | no |  |
| contact | varchar | type/Text | type/Category | no | no |  |
| remind_check_in | int4 | type/Integer |  | no | no |  |
| remind_check_out | int4 | type/Integer |  | no | no |  |
| remind_cancel | int4 | type/Integer |  | no | no |  |
| auto_cancel_booking | int4 | type/Integer |  | no | no |  |
| enable_the1_point_earning | bool | type/Boolean | type/Category | no | no |  |
| website | varchar | type/Text |  | no | no |  |
| logo | jsonb | type/JSON | type/SerializedJSON | no | no |  |
| stripe_connect_id | varchar | type/Text | type/Category | no | no |  |
| tax_number | varchar | type/Text | type/Category | no | no |  |
| roaming_fee_percentage | numeric | type/Decimal | type/Share | no | no |  |
| commission_percentage | numeric | type/Decimal | type/Share | no | no |  |
| stripe_connect_type | varchar | type/Text | type/Category | no | no |  |
| stripe_onboarding_complete | bool | type/Boolean | type/Category | no | no |  |
| is_sharge_wallet_enabled | bool | type/Boolean | type/Category | yes | no |  |

### public.ocpi_sessions

- Table ID: 95
- Display name: Ocpi Sessions
- Entity type: entity/GenericTable
- Field count: 40
- Estimated row count: 0

| Column | DB Type | Base Type | Semantic Type | Required | Indexed | FK |
| --- | --- | --- | --- | --- | --- | --- |
| cdr_token → contract_id | text | type/Text | type/Category | no | no |  |
| cdr_token → country_code | text | type/Text | type/Category | no | no |  |
| cdr_token → party_id | text | type/Text | type/Category | no | no |  |
| cdr_token → type | text | type/Text | type/Category | no | no |  |
| cdr_token → uid | text | type/Text |  | no | no |  |
| id | uuid | type/UUID | type/PK | no | yes |  |
| total_cost → excl_vat | double precision | type/Number | type/Cost | no | no |  |
| total_cost → incl_vat | double precision | type/Number | type/Cost | no | no |  |
| created_at | timestamp | type/DateTime | type/CreationTimestamp | no | yes |  |
| last_updated | timestamp | type/DateTime | type/UpdatedTimestamp | no | no |  |
| country_code | varchar | type/Text | type/Country | yes | no |  |
| party_id | varchar | type/Text | type/Category | yes | no |  |
| start_date_time | timestamp | type/DateTime | type/CreationTimestamp | yes | yes |  |
| end_date_time | timestamp | type/DateTime |  | no | no |  |
| auth_method | varchar | type/Text | type/Category | no | no |  |
| authorization_reference | varchar | type/Text | type/Author | no | no |  |
| location_id | uuid | type/UUID | type/FK | yes | yes | ocpi_locations.id |
| meter_id | varchar | type/Text |  | no | no |  |
| evse_id | uuid | type/UUID | type/FK | yes | yes | ocpi_evses.id |
| currency | varchar | type/Text | type/Category | yes | no |  |
| status | varchar | type/Text | type/Category | yes | yes |  |
| transaction_id | int4 | type/Integer |  | no | yes |  |
| user_id | uuid | type/UUID | type/FK | no | yes | users.id |
| booking_id | uuid | type/UUID | type/FK | no | yes | bookings.id |
| total_cost | jsonb | type/JSON | type/SerializedJSON | no | no |  |
| reference_id | varchar | type/Text |  | no | yes |  |
| invoice_id | uuid | type/UUID | type/FK | no | yes | invoices.id |
| meter_start_wh | int4 | type/Integer | type/Category | no | no |  |
| meter_value_wh | int4 | type/Integer |  | no | no |  |
| token_id | uuid | type/UUID | type/FK | no | yes | ocpi_tokens.id |
| connector_id | uuid | type/UUID | type/FK | no | no | ocpi_connectors.id |
| uid | varchar | type/Text |  | yes | yes |  |
| kwh | numeric | type/Decimal |  | yes | no |  |
| overtime | timestamp | type/DateTime |  | no | no |  |
| vid | varchar | type/Text |  | no | yes |  |
| started_via | varchar | type/Text |  | no | no |  |
| session_vehicle | jsonb | type/JSON | type/SerializedJSON | no | no |  |
| threshold_status | varchar | type/Text |  | no | no |  |
| cdr_token | jsonb | type/JSON | type/SerializedJSON | no | no |  |
| version | int4 | type/Integer | type/Category | yes | no |  |

### public.ocpi_sessions_tariffs

- Table ID: 72
- Display name: Ocpi Sessions Tariffs
- Entity type: entity/GenericTable
- Field count: 2
- Estimated row count: 0

| Column | DB Type | Base Type | Semantic Type | Required | Indexed | FK |
| --- | --- | --- | --- | --- | --- | --- |
| tariff_id | uuid | type/UUID | type/FK | yes | yes | ocpi_tariffs.id |
| session_id | uuid | type/UUID | type/FK | yes | yes | ocpi_sessions.id |

### public.ocpi_tariffs

- Table ID: 53
- Display name: Ocpi Tariffs
- Entity type: entity/GenericTable
- Field count: 19
- Estimated row count: 0

| Column | DB Type | Base Type | Semantic Type | Required | Indexed | FK |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | type/UUID | type/PK | no | yes |  |
| created_at | timestamp | type/DateTime | type/CreationTimestamp | no | no |  |
| last_updated | timestamp | type/DateTime | type/UpdatedTimestamp | no | no |  |
| country_code | varchar | type/Text | type/Country | yes | no |  |
| party_id | varchar | type/Text | type/Category | yes | no |  |
| currency | varchar | type/Text | type/Category | yes | no |  |
| type | varchar | type/Text | type/Category | no | no |  |
| tariff_alt_url | varchar | type/Text | type/URL | no | no |  |
| min_price | jsonb | type/JSON | type/SerializedJSON | no | no |  |
| max_price | jsonb | type/JSON | type/SerializedJSON | no | no |  |
| start_date_time | timestamp | type/DateTime | type/CreationTimestamp | no | no |  |
| end_date_time | timestamp | type/DateTime |  | no | no |  |
| energy_mix | jsonb | type/JSON | type/SerializedJSON | no | no |  |
| elements | jsonb | type/JSON | type/SerializedJSON | yes | no |  |
| session_id | uuid | type/UUID | type/FK | no | no | ocpi_sessions.id |
| cdr_id | uuid | type/UUID | type/FK | no | no | ocpi_cdrs.id |
| tariff_alt_text | jsonb | type/JSON | type/SerializedJSON | no | no |  |
| pricing_scheme | varchar | type/Text | type/Category | no | no |  |
| uid | varchar | type/Text |  | yes | yes |  |

### public.ocpi_tokens

- Table ID: 85
- Display name: Ocpi Tokens
- Entity type: entity/GenericTable
- Field count: 20
- Estimated row count: 0

| Column | DB Type | Base Type | Semantic Type | Required | Indexed | FK |
| --- | --- | --- | --- | --- | --- | --- |
| energy_contract → contract_id | text | type/Text |  | no | no |  |
| energy_contract → supplier_name | text | type/Text |  | no | no |  |
| id | uuid | type/UUID | type/PK | no | yes |  |
| created_at | timestamp | type/DateTime | type/CreationTimestamp | no | no |  |
| last_updated | timestamp | type/DateTime | type/UpdatedTimestamp | no | no |  |
| country_code | varchar | type/Text | type/Country | yes | no |  |
| party_id | varchar | type/Text | type/Category | yes | no |  |
| uid | varchar | type/Text |  | yes | yes |  |
| type | varchar | type/Text | type/Category | yes | no |  |
| contract_id | varchar | type/Text |  | yes | no |  |
| visual_number | varchar | type/Text |  | no | no |  |
| issuer | varchar | type/Text | type/Category | yes | no |  |
| group_id | varchar | type/Text |  | no | no |  |
| valid | bool | type/Boolean | type/Category | yes | no |  |
| whitelist | varchar | type/Text | type/Category | yes | no |  |
| language | varchar | type/Text | type/Category | no | no |  |
| default_profile_type | varchar | type/Text | type/Category | no | no |  |
| energy_contract | jsonb | type/JSON | type/SerializedJSON | no | no |  |
| user_id | uuid | type/UUID | type/FK | no | no | users.id |
| id_tag | varchar | type/Text |  | yes | yes |  |

### public.ocpp_central_system_queue

- Table ID: 86
- Display name: Ocpp Central System Queue
- Entity type: entity/GenericTable
- Field count: 7
- Estimated row count: 0

| Column | DB Type | Base Type | Semantic Type | Required | Indexed | FK |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | type/UUID | type/PK | no | yes |  |
| created_at | timestamp | type/DateTime | type/CreationTimestamp | no | no |  |
| updated_at | timestamp | type/DateTime | type/UpdatedTimestamp | no | no |  |
| identifier | varchar | type/Text | type/Category | yes | no |  |
| event_name | varchar | type/Text | type/Category | yes | no |  |
| payload | jsonb | type/JSON | type/SerializedJSON | yes | no |  |
| status | varchar | type/Text | type/Category | yes | no |  |

### public.ocpp_events

- Table ID: 45
- Display name: Ocpp Events
- Entity type: entity/EventTable
- Field count: 24
- Estimated row count: 0

| Column | DB Type | Base Type | Semantic Type | Required | Indexed | FK |
| --- | --- | --- | --- | --- | --- | --- |
| data → connectorId | bigint | type/Integer | type/Category | no | no |  |
| data → errorCode | text | type/Text | type/Category | no | no |  |
| data → idTag | text | type/Text | type/Category | no | no |  |
| data → info | text | type/Text | type/Category | no | no |  |
| data → meterStart | bigint | type/Integer | type/Category | no | no |  |
| data → meterStop | bigint | type/Integer | type/Category | no | no |  |
| data → meterValue | text | type/Array |  | no | no |  |
| data → reason | text | type/Text | type/Category | no | no |  |
| data → status | text | type/Text | type/Category | no | no |  |
| data → timestamp | timestamp | type/DateTime |  | no | no |  |
| data → transactionId | bigint | type/Integer | type/Category | no | no |  |
| data → vendorErrorCode | text | type/Text | type/Company | no | no |  |
| data → vendorId | text | type/Text | type/Company | no | no |  |
| id | uuid | type/UUID | type/PK | no | yes |  |
| created_at | timestamp | type/DateTime | type/CreationTimestamp | no | no |  |
| updated_at | timestamp | type/DateTime | type/UpdatedTimestamp | no | no |  |
| event | varchar | type/Text | type/Category | yes | no |  |
| data | jsonb | type/JSON | type/SerializedJSON | yes | no |  |
| evse_id | uuid | type/UUID | type/FK | no | no | ocpi_evses.id |
| session_id | uuid | type/UUID | type/FK | no | no | ocpi_sessions.id |
| identifier | varchar | type/Text | type/Category | yes | no |  |
| timestamp | timestamp | type/DateTime |  | no | yes |  |
| message_id | varchar | type/Text | type/Category | no | no |  |
| message_hash | varchar | type/Text |  | no | yes |  |

### public.old_devices

- Table ID: 119
- Display name: Old Devices
- Entity type: entity/GenericTable
- Field count: 9
- Estimated row count: 0

| Column | DB Type | Base Type | Semantic Type | Required | Indexed | FK |
| --- | --- | --- | --- | --- | --- | --- |
| device_token → token | text | type/Text |  | no | no |  |
| device_token → type | text | type/Text | type/Category | no | no |  |
| id | uuid | type/UUID | type/PK | no | yes |  |
| created_at | timestamp | type/DateTime | type/CreationTimestamp | no | no |  |
| updated_at | timestamp | type/DateTime | type/UpdatedTimestamp | no | no |  |
| device_token | jsonb | type/JSON | type/SerializedJSON | no | no |  |
| enable_push | bool | type/Boolean | type/Category | yes | no |  |
| user_id | uuid | type/UUID |  | no | yes |  |
| device_uuid | varchar | type/Text | type/Category | no | no |  |

### public.operator_admins

- Table ID: 89
- Display name: Operator Admins
- Entity type: entity/GenericTable
- Field count: 5
- Estimated row count: 0

| Column | DB Type | Base Type | Semantic Type | Required | Indexed | FK |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | type/UUID | type/PK | no | yes |  |
| created_at | timestamp | type/DateTime | type/CreationTimestamp | no | no |  |
| updated_at | timestamp | type/DateTime | type/UpdatedTimestamp | no | no |  |
| operator_id | uuid | type/UUID | type/FK | no | yes | ocpi_operators.id |
| user_id | uuid | type/UUID | type/FK | no | no | users.id |

### public.organization_budget_cycles

- Table ID: 126
- Display name: Organization Budget Cycles
- Entity type: entity/GenericTable
- Field count: 14
- Estimated row count: 0

| Column | DB Type | Base Type | Semantic Type | Required | Indexed | FK |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | type/UUID | type/PK | no | yes |  |
| created_at | timestamp | type/DateTime | type/CreationTimestamp | no | no |  |
| updated_at | timestamp | type/DateTime | type/UpdatedTimestamp | no | no |  |
| organization_id | uuid | type/UUID | type/FK | yes | no | organizations.id |
| type | varchar | type/Text | type/Category | yes | no |  |
| status | varchar | type/Text | type/Category | yes | no |  |
| transaction_day_of_month | int4 | type/Integer | type/Category | yes | no |  |
| start_date_time | timestamp | type/DateTime | type/CreationTimestamp | yes | no |  |
| end_date_time | timestamp | type/DateTime |  | yes | no |  |
| is_budget_mode_enabled | bool | type/Boolean | type/Category | yes | no |  |
| total_budget_satang | int4 | type/Integer | type/Category | yes | no |  |
| total_allocated_budget_satang | int4 | type/Integer | type/Category | yes | no |  |
| total_spent_budget_satang | int4 | type/Integer | type/Category | yes | no |  |
| total_remaining_budget_satang | int4 | type/Integer | type/Category | yes | no |  |

### public.organization_budget_usages

- Table ID: 124
- Display name: Organization Budget Usages
- Entity type: entity/GenericTable
- Field count: 7
- Estimated row count: 0

| Column | DB Type | Base Type | Semantic Type | Required | Indexed | FK |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | type/UUID | type/PK | no | yes |  |
| created_at | timestamp | type/DateTime | type/CreationTimestamp | no | no |  |
| updated_at | timestamp | type/DateTime | type/UpdatedTimestamp | no | no |  |
| session_id | uuid | type/UUID | type/FK | yes | no | ocpi_sessions.id |
| organization_budget_cycle_id | uuid | type/UUID | type/FK | yes | no | organization_budget_cycles.id |
| organization_token_id | uuid | type/UUID | type/FK | yes | no | organizations_tokens.id |
| amount_satang | int4 | type/Integer |  | yes | no |  |

### public.organization_invoices

- Table ID: 127
- Display name: Organization Invoices
- Entity type: entity/GenericTable
- Field count: 13
- Estimated row count: 0

| Column | DB Type | Base Type | Semantic Type | Required | Indexed | FK |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | type/UUID | type/PK | no | yes |  |
| created_at | timestamp | type/DateTime | type/CreationTimestamp | no | no |  |
| updated_at | timestamp | type/DateTime | type/UpdatedTimestamp | no | no |  |
| reference_id | varchar | type/Text | type/Category | yes | yes |  |
| type | varchar | type/Text | type/Category | yes | no |  |
| status | varchar | type/Text | type/Category | yes | no |  |
| settled_at | timestamp | type/DateTime |  | no | no |  |
| total_cost_satang | int4 | type/Integer | type/Cost | yes | no |  |
| total_satang | int4 | type/Integer | type/Category | yes | no |  |
| total_vat_satang | int4 | type/Integer | type/Category | yes | no |  |
| remark | text | type/Text |  | no | no |  |
| organization_id | uuid | type/UUID | type/FK | yes | no | organizations.id |
| organization_budget_cycle_id | uuid | type/UUID | type/FK | no | no | organization_budget_cycles.id |

### public.organization_member_tokens

- Table ID: 123
- Display name: Organization Member Tokens
- Entity type: entity/GenericTable
- Field count: 8
- Estimated row count: 0

| Column | DB Type | Base Type | Semantic Type | Required | Indexed | FK |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | type/UUID | type/PK | no | yes |  |
| created_at | timestamp | type/DateTime | type/CreationTimestamp | no | no |  |
| updated_at | timestamp | type/DateTime | type/UpdatedTimestamp | no | no |  |
| organization_token_id | uuid | type/UUID | type/FK | yes | no | organizations_tokens.id |
| organization_member_id | uuid | type/UUID | type/FK | yes | no | organizations_members.id |
| assigned_by_id | uuid | type/UUID | type/FK | yes | no | users.id |
| deleted_at | timestamp | type/DateTime | type/DeletionTimestamp | no | no |  |
| deleted_by_user_id | uuid | type/UUID | type/FK | no | no | users.id |

### public.organization_token_budgets

- Table ID: 125
- Display name: Organization Token Budgets
- Entity type: entity/GenericTable
- Field count: 11
- Estimated row count: 0

| Column | DB Type | Base Type | Semantic Type | Required | Indexed | FK |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | type/UUID | type/PK | no | yes |  |
| created_at | timestamp | type/DateTime | type/CreationTimestamp | no | no |  |
| updated_at | timestamp | type/DateTime | type/UpdatedTimestamp | no | no |  |
| organization_token_id | uuid | type/UUID | type/FK | yes | yes | organizations_tokens.id |
| organization_budget_cycle_id | uuid | type/UUID | type/FK | yes | no | organization_budget_cycles.id |
| allocated_budget_satang | int4 | type/Integer | type/Category | yes | no |  |
| spent_budget_satang | int4 | type/Integer | type/Category | yes | no |  |
| remaining_budget_satang | int4 | type/Integer | type/Category | yes | no |  |
| status | varchar | type/Text | type/Category | yes | no |  |
| created_by_id | uuid | type/UUID | type/FK | yes | no | users.id |
| updated_by_id | uuid | type/UUID | type/FK | yes | no | users.id |

### public.organizations

- Table ID: 103
- Display name: Organizations
- Entity type: entity/GenericTable
- Field count: 12
- Estimated row count: 0

| Column | DB Type | Base Type | Semantic Type | Required | Indexed | FK |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | type/UUID | type/PK | no | yes |  |
| created_at | timestamp | type/DateTime | type/CreationTimestamp | no | no |  |
| updated_at | timestamp | type/DateTime | type/UpdatedTimestamp | no | no |  |
| name | varchar | type/Text | type/Name | yes | no |  |
| is_budget_mode_enabled | bool | type/Boolean | type/Category | yes | no |  |
| total_budget_amount_satang | int4 | type/Integer |  | no | no |  |
| has_access_to_all_locations | bool | type/Boolean | type/Category | yes | no |  |
| base_price_satang | int4 | type/Integer | type/Category | no | no |  |
| special_prices | json | type/JSON | type/SerializedJSON | no | no |  |
| total_budget_satang | int4 | type/Integer |  | no | no |  |
| transaction_day_of_month | int4 | type/Integer | type/Category | yes | no |  |
| current_budget_cycle_id | uuid | type/UUID | type/FK | no | no | organization_budget_cycles.id |

### public.organizations_members

- Table ID: 104
- Display name: Organizations Members
- Entity type: entity/GenericTable
- Field count: 9
- Estimated row count: 0

| Column | DB Type | Base Type | Semantic Type | Required | Indexed | FK |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | type/UUID | type/PK | no | yes |  |
| created_at | timestamp | type/DateTime | type/CreationTimestamp | no | no |  |
| updated_at | timestamp | type/DateTime | type/UpdatedTimestamp | no | no |  |
| role | varchar | type/Text | type/Category | yes | no |  |
| organization_id | uuid | type/UUID | type/FK | yes | no | organizations.id |
| member_id | uuid | type/UUID | type/FK | yes | no | users.id |
| allocated_budget_amount_satang | int4 | type/Integer |  | no | no |  |
| deleted_at | timestamp | type/DateTime | type/DeletionTimestamp | no | no |  |
| deleted_by_user_id | uuid | type/UUID | type/FK | no | no | users.id |

### public.organizations_tariffs

- Table ID: 116
- Display name: Organizations Tariffs
- Entity type: entity/GenericTable
- Field count: 3
- Estimated row count: 0

| Column | DB Type | Base Type | Semantic Type | Required | Indexed | FK |
| --- | --- | --- | --- | --- | --- | --- |
| organization_id | uuid | type/UUID | type/PK | yes | yes |  |
| evse_id | uuid | type/UUID | type/PK | yes | no |  |
| tariff_id | uuid | type/UUID | type/FK | yes | no | ocpi_tariffs.id |

### public.organizations_tokens

- Table ID: 102
- Display name: Organizations Tokens
- Entity type: entity/GenericTable
- Field count: 6
- Estimated row count: 0

| Column | DB Type | Base Type | Semantic Type | Required | Indexed | FK |
| --- | --- | --- | --- | --- | --- | --- |
| organization_id | uuid | type/UUID | type/FK | yes | yes | organizations.id |
| token_id | uuid | type/UUID | type/FK | yes | yes | ocpi_tokens.id |
| requires_activation | bool | type/Boolean | type/Category | yes | no |  |
| id | uuid | type/UUID | type/PK | no | yes |  |
| created_at | timestamp | type/DateTime | type/CreationTimestamp | no | no |  |
| updated_at | timestamp | type/DateTime | type/UpdatedTimestamp | no | no |  |

### public.oscp1_aggregated_usages

- Table ID: 71
- Display name: Oscp1 Aggregated Usages
- Entity type: entity/GenericTable
- Field count: 8
- Estimated row count: 0

| Column | DB Type | Base Type | Semantic Type | Required | Indexed | FK |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | type/UUID | type/PK | no | yes |  |
| created_at | timestamp | type/DateTime | type/CreationTimestamp | no | no |  |
| updated_at | timestamp | type/DateTime | type/UpdatedTimestamp | no | no |  |
| charge_points | jsonb | type/JSON | type/SerializedJSON | yes | no |  |
| location_id | uuid | type/UUID | type/FK | no | no | ocpi_locations.id |
| cable_capacity_forecast_id | uuid | type/UUID | type/FK | no | yes | oscp1_cable_capacity_forecasts.id |
| meter_start | numeric | type/Decimal |  | yes | no |  |
| meter_end | numeric | type/Decimal |  | yes | no |  |

### public.oscp1_cable_capacity_forecasts

- Table ID: 80
- Display name: Oscp1 Cable Capacity Forecasts
- Entity type: entity/GenericTable
- Field count: 12
- Estimated row count: 0

| Column | DB Type | Base Type | Semantic Type | Required | Indexed | FK |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | type/UUID | type/PK | no | yes |  |
| created_at | timestamp | type/DateTime | type/CreationTimestamp | no | no |  |
| updated_at | timestamp | type/DateTime | type/UpdatedTimestamp | no | no |  |
| schedule_id | int4 | type/Integer |  | yes | yes |  |
| station_id | int4 | type/Integer | type/Category | yes | no |  |
| start_date_time | timestamp | type/DateTime | type/CreationTimestamp | yes | yes |  |
| end_date_time | timestamp | type/DateTime |  | yes | no |  |
| charging_rate_unit | varchar | type/Text | type/Category | yes | no |  |
| limit | numeric | type/Decimal |  | yes | no |  |
| result | varchar | type/Text | type/Category | yes | no |  |
| location_id | uuid | type/UUID | type/FK | no | no | ocpi_locations.id |
| aggregated_usage_updated | bool | type/Boolean | type/Category | yes | no |  |

### public.oscp2_capacity_providers

- Table ID: 57
- Display name: Oscp2 Capacity Providers
- Entity type: entity/GenericTable
- Field count: 9
- Estimated row count: 0

| Column | DB Type | Base Type | Semantic Type | Required | Indexed | FK |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | type/UUID | type/PK | no | yes |  |
| created_at | timestamp | type/DateTime | type/CreationTimestamp | no | no |  |
| updated_at | timestamp | type/DateTime | type/UpdatedTimestamp | no | no |  |
| token | varchar | type/Text | type/Category | yes | yes |  |
| token_b | varchar | type/Text | type/Category | no | no |  |
| url | varchar | type/Text | type/URL | yes | no |  |
| is_registered | bool | type/Boolean | type/Category | yes | no |  |
| heartbeat_interval | int4 | type/Integer | type/Category | yes | no |  |
| last_heartbeat_at | timestamp | type/DateTime |  | no | no |  |

### public.oscp2_capacity_providers_locations

- Table ID: 65
- Display name: Oscp2 Capacity Providers Locations
- Entity type: entity/GenericTable
- Field count: 3
- Estimated row count: 0

| Column | DB Type | Base Type | Semantic Type | Required | Indexed | FK |
| --- | --- | --- | --- | --- | --- | --- |
| capacity_provider_id | uuid | type/UUID | type/FK | yes | yes | oscp2_capacity_providers.id |
| location_id | uuid | type/UUID | type/FK | yes | no | ocpi_locations.id |
| group_id | varchar | type/Text | type/PK | yes | no |  |

### public.oscp2_event_queue

- Table ID: 56
- Display name: Oscp2 Event Queue
- Entity type: entity/GenericTable
- Field count: 8
- Estimated row count: 0

| Column | DB Type | Base Type | Semantic Type | Required | Indexed | FK |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | type/UUID | type/PK | no | yes |  |
| created_at | timestamp | type/DateTime | type/CreationTimestamp | no | no |  |
| updated_at | timestamp | type/DateTime | type/UpdatedTimestamp | no | no |  |
| action | varchar | type/Text | type/Category | yes | no |  |
| x_correlation_id | varchar | type/Text | type/Category | yes | no |  |
| status | varchar | type/Text | type/Category | yes | no |  |
| processed_at | timestamp | type/DateTime |  | no | no |  |
| capacity_provider_id | uuid | type/UUID | type/FK | no | no | oscp2_capacity_providers.id |

### public.oscp2_forecasted_blocks

- Table ID: 49
- Display name: Oscp2 Forecasted Blocks
- Entity type: entity/GenericTable
- Field count: 12
- Estimated row count: 0

| Column | DB Type | Base Type | Semantic Type | Required | Indexed | FK |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | type/UUID | type/PK | no | yes |  |
| created_at | timestamp | type/DateTime | type/CreationTimestamp | no | no |  |
| updated_at | timestamp | type/DateTime | type/UpdatedTimestamp | no | no |  |
| x_correlation_id | varchar | type/Text |  | yes | no |  |
| group_id | varchar | type/Text | type/Category | yes | no |  |
| type | varchar | type/Text | type/Category | yes | no |  |
| capacity | int4 | type/Integer | type/Category | yes | no |  |
| phase | varchar | type/Text | type/Category | yes | no |  |
| unit | varchar | type/Text | type/Category | yes | no |  |
| start_time | timestamp | type/DateTime | type/CreationTimestamp | yes | no |  |
| end_time | timestamp | type/DateTime |  | yes | no |  |
| location_id | uuid | type/UUID | type/FK | no | no | ocpi_locations.id |

### public.oscp2_group_measurements

- Table ID: 70
- Display name: Oscp2 Group Measurements
- Entity type: entity/GenericTable
- Field count: 5
- Estimated row count: 0

| Column | DB Type | Base Type | Semantic Type | Required | Indexed | FK |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | type/UUID | type/PK | no | yes |  |
| created_at | timestamp | type/DateTime | type/CreationTimestamp | no | no |  |
| updated_at | timestamp | type/DateTime | type/UpdatedTimestamp | no | no |  |
| group_id | varchar | type/Text | type/Category | yes | no |  |
| measurements | jsonb | type/JSON | type/SerializedJSON | yes | no |  |

### public.partner_integrations

- Table ID: 96
- Display name: Partner Integrations
- Entity type: entity/GenericTable
- Field count: 23
- Estimated row count: 0

| Column | DB Type | Base Type | Semantic Type | Required | Indexed | FK |
| --- | --- | --- | --- | --- | --- | --- |
| data → cards | text | type/Array |  | no | no |  |
| data → contactEmails | text | type/Array |  | no | no |  |
| data → contactNumbers | text | type/Array |  | no | no |  |
| data → createdAt | timestamp | type/DateTime | type/CreationTimestamp | no | no |  |
| data → firstname | text | type/Text |  | no | no |  |
| data → firstnameEn | text | type/Text |  | no | no |  |
| data → lastname | text | type/Text |  | no | no |  |
| data → lastnameEn | text | type/Text |  | no | no |  |
| data → memberFirstNameEng | text | type/Text |  | no | no |  |
| data → memberFirstNameThai | text | type/Text |  | no | no |  |
| data → memberLastNameEng | text | type/Text |  | no | no |  |
| data → memberLastNameThai | text | type/Text |  | no | no |  |
| data → memberNo | text | type/Text |  | no | no |  |
| data → memberTier | text | type/Text | type/Category | no | no |  |
| data → objectId | text | type/Text |  | no | no |  |
| data → projects | text | type/Array |  | no | no |  |
| data → updatedAt | timestamp | type/DateTime | type/UpdatedTimestamp | no | no |  |
| id | uuid | type/UUID | type/PK | no | yes |  |
| created_at | timestamp | type/DateTime | type/CreationTimestamp | no | no |  |
| updated_at | timestamp | type/DateTime | type/UpdatedTimestamp | no | no |  |
| type | varchar | type/Text | type/Category | yes | no |  |
| data | jsonb | type/JSON | type/SerializedJSON | yes | no |  |
| user_id | uuid | type/UUID | type/FK | no | no | users.id |

### public.payment_methods

- Table ID: 67
- Display name: Payment Methods
- Entity type: entity/GenericTable
- Field count: 30
- Estimated row count: 0

| Column | DB Type | Base Type | Semantic Type | Required | Indexed | FK |
| --- | --- | --- | --- | --- | --- | --- |
| attributes → accumulated_kwh | bigint | type/Integer | type/Category | no | no |  |
| attributes → activation_code | text | type/Text |  | no | no |  |
| attributes → brand | text | type/Text | type/Category | no | no |  |
| attributes → current_tier | bigint | type/Integer | type/Category | no | no |  |
| attributes → date_since | text | type/Text | type/Category | no | no |  |
| attributes → expiration_month | bigint | type/Integer | type/Category | no | no |  |
| attributes → expiration_year | bigint | type/Integer | type/Category | no | no |  |
| attributes → fingerprint | text | type/Text | type/Category | no | no |  |
| attributes → last_digits | text | type/Text |  | no | no |  |
| attributes → next_tier | bigint | type/Integer | type/Category | no | no |  |
| attributes → wallet_icon | text | type/Text | type/Category | no | no |  |
| attributes → wallet_id | text | type/Text |  | no | no |  |
| attributes → wallet_image | text | type/Text | type/Category | no | no |  |
| attributes → wallet_name | text | type/Text | type/Category | no | no |  |
| id | uuid | type/UUID | type/PK | no | yes |  |
| metadata → stripe_transaction_id | text | type/Text |  | no | no |  |
| created_at | timestamp | type/DateTime | type/CreationTimestamp | no | no |  |
| updated_at | timestamp | type/DateTime | type/UpdatedTimestamp | no | no |  |
| customer_id | varchar | type/Text |  | no | no |  |
| account_id | varchar | type/Text |  | no | no |  |
| attributes | jsonb | type/JSON | type/SerializedJSON | no | yes |  |
| is_default | bool | type/Boolean | type/Category | yes | no |  |
| metadata | jsonb | type/JSON | type/SerializedJSON | no | yes |  |
| deleted_at | timestamp | type/DateTime | type/DeletionTimestamp | no | no |  |
| user_id | uuid | type/UUID | type/FK | no | yes | users.id |
| car_id | uuid | type/UUID | type/FK | no | no | cars.id |
| provider | varchar | type/Text | type/Category | yes | yes |  |
| verification_status | varchar | type/Text | type/Category | yes | no |  |
| privilege_program_type | varchar | type/Text | type/Category | no | no |  |
| privilege_program_id | uuid | type/UUID | type/FK | no | yes | privilege_programs.id |

### public.payments

- Table ID: 47
- Display name: Payments
- Entity type: entity/GenericTable
- Field count: 32
- Estimated row count: 0

| Column | DB Type | Base Type | Semantic Type | Required | Indexed | FK |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | type/UUID | type/PK | no | yes |  |
| metadata → admin_id | text | type/Text | type/Category | no | no |  |
| metadata → charged_by | text | type/Text | type/Category | no | no |  |
| metadata → commission_amount_in_satangs | bigint | type/Integer | type/Category | no | no |  |
| metadata → commission_amount_satang | double precision | type/Number |  | no | no |  |
| metadata → commission_percentage | text | type/Text | type/Category | no | no |  |
| metadata → failure_message | text | type/Text | type/Category | no | no |  |
| metadata → kbank_charge_id | text | type/Text |  | no | no |  |
| metadata → kbank_reference_order | text | type/Text |  | no | no |  |
| metadata → omise_charge_id | text | type/Text |  | no | no |  |
| metadata → omise_failure_message | text | type/Text | type/Category | no | no |  |
| metadata → omise_refund_id | text | type/Text |  | no | no |  |
| metadata → stripe_connect_id | text | type/Text | type/Category | no | no |  |
| metadata → stripe_connect_type | text | type/Text | type/Category | no | no |  |
| metadata → stripe_failure_message | text | type/Text | type/Category | no | no |  |
| metadata → stripe_payment_intent_id | text | type/Text | type/Category | no | no |  |
| metadata → stripe_transaction_id | text | type/Text |  | no | no |  |
| metadata → stripe_verification_url | text | type/Text | type/URL | no | no |  |
| created_at | timestamp | type/DateTime | type/CreationTimestamp | no | yes |  |
| updated_at | timestamp | type/DateTime | type/UpdatedTimestamp | no | no |  |
| amount | int4 | type/Integer |  | yes | no |  |
| points | int4 | type/Integer | type/Category | no | no |  |
| transaction_id | varchar | type/Text |  | no | yes |  |
| metadata | jsonb | type/JSON | type/SerializedJSON | no | no |  |
| user_id | uuid | type/UUID | type/FK | no | no | users.id |
| payment_method_id | uuid | type/UUID | type/FK | no | yes | payment_methods.id |
| payment_status | varchar | type/Text | type/Category | yes | yes |  |
| payment_type | varchar | type/Text | type/Category | yes | no |  |
| invoice_id | uuid | type/UUID | type/FK | no | yes | invoices.id |
| refund_transaction_id | varchar | type/Text |  | no | no |  |
| refund_type | varchar | type/Text | type/Category | no | no |  |
| refund_amount_satang | int4 | type/Integer |  | no | no |  |

### public.phone_numbers

- Table ID: 120
- Display name: Phone Numbers
- Entity type: entity/GenericTable
- Field count: 7
- Estimated row count: 0

| Column | DB Type | Base Type | Semantic Type | Required | Indexed | FK |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | type/UUID | type/PK | no | yes |  |
| created_at | timestamp | type/DateTime | type/CreationTimestamp | no | no |  |
| updated_at | timestamp | type/DateTime | type/UpdatedTimestamp | no | no |  |
| calling_code | varchar | type/Text | type/Category | yes | yes |  |
| national_number | varchar | type/Text | type/Category | yes | no |  |
| e164 | varchar | type/Text | type/Category | yes | no |  |
| current_user_id | uuid | type/UUID | type/FK | no | no | users.id |

### public.point_transactions

- Table ID: 79
- Display name: Point Transactions
- Entity type: entity/TransactionTable
- Field count: 11
- Estimated row count: 0

| Column | DB Type | Base Type | Semantic Type | Required | Indexed | FK |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | type/UUID | type/PK | no | yes |  |
| created_at | timestamp | type/DateTime | type/CreationTimestamp | no | no |  |
| updated_at | timestamp | type/DateTime | type/UpdatedTimestamp | no | no |  |
| card_no | varchar | type/Text | type/Category | yes | no |  |
| points | int4 | type/Integer | type/Category | no | no |  |
| is_sync_to_partner | bool | type/Boolean | type/Category | yes | no |  |
| user_id | uuid | type/UUID | type/FK | no | no | users.id |
| booking_id | uuid | type/UUID | type/FK | no | no | bookings.id |
| status | varchar | type/Text | type/Category | yes | no |  |
| provider | varchar | type/Text | type/Category | no | no |  |
| invoice_id | uuid | type/UUID | type/FK | no | no | invoices.id |

### public.porsche_credits

- Table ID: 51
- Display name: Porsche Credits
- Entity type: entity/GenericTable
- Field count: 5
- Estimated row count: 0

| Column | DB Type | Base Type | Semantic Type | Required | Indexed | FK |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | type/UUID | type/PK | no | yes |  |
| created_at | timestamp | type/DateTime |  | no | no |  |
| updated_at | timestamp | type/DateTime |  | no | no |  |
| amount | int4 | type/Integer |  | yes | no |  |
| car_id | uuid | type/UUID | type/FK | no | no | cars.id |

### public.privilege_codes

- Table ID: 61
- Display name: Privilege Codes
- Entity type: entity/GenericTable
- Field count: 10
- Estimated row count: 0

| Column | DB Type | Base Type | Semantic Type | Required | Indexed | FK |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | type/UUID | type/PK | no | yes |  |
| created_at | timestamp | type/DateTime | type/CreationTimestamp | no | no |  |
| updated_at | timestamp | type/DateTime | type/UpdatedTimestamp | no | no |  |
| vin | varchar | type/Text |  | yes | yes |  |
| activation_code | varchar | type/Text |  | yes | yes |  |
| redeemed_at | timestamp | type/DateTime |  | no | no |  |
| vid | varchar | type/Text | type/Category | no | no |  |
| tag | varchar | type/Text | type/Category | no | no |  |
| redeemed_by_id | uuid | type/UUID | type/FK | no | no | users.id |
| expires_at | timestamp | type/DateTime |  | no | no |  |

### public.privilege_codes_customer_groups

- Table ID: 99
- Display name: Privilege Codes Customer Groups
- Entity type: entity/GenericTable
- Field count: 2
- Estimated row count: 0

| Column | DB Type | Base Type | Semantic Type | Required | Indexed | FK |
| --- | --- | --- | --- | --- | --- | --- |
| privilege_code_id | uuid | type/UUID | type/FK | yes | yes | privilege_codes.id |
| customer_group_id | uuid | type/UUID | type/FK | yes | yes | customer_groups.id |

### public.privilege_programs

- Table ID: 66
- Display name: Privilege Programs
- Entity type: entity/GenericTable
- Field count: 21
- Estimated row count: 0

| Column | DB Type | Base Type | Semantic Type | Required | Indexed | FK |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | type/UUID | type/PK | no | yes |  |
| metadata → description | text | type/Text | type/Description | no | no |  |
| metadata → kwh_price | double precision | type/Float |  | no | no |  |
| metadata → min_kwh | bigint | type/Integer | type/Category | no | no |  |
| metadata → num_months_restore_quota | bigint | type/Integer | type/Category | no | no |  |
| metadata → tier | bigint | type/Integer | type/Category | no | no |  |
| created_at | timestamp | type/DateTime | type/CreationTimestamp | no | no |  |
| updated_at | timestamp | type/DateTime | type/UpdatedTimestamp | no | no |  |
| name | varchar | type/Text | type/Name | yes | no |  |
| provider | varchar | type/Text | type/Category | yes | no |  |
| type | varchar | type/Text | type/Category | yes | no |  |
| wallet_name | varchar | type/Text | type/Category | yes | no |  |
| wallet_icon | varchar | type/Text | type/URL | yes | no |  |
| wallet_image | varchar | type/Text | type/URL | yes | no |  |
| credit_unit | varchar | type/Text | type/Category | yes | no |  |
| credit_value | int4 | type/Integer | type/Category | yes | no |  |
| discount_percent | int4 | type/Integer | type/Discount | no | no |  |
| expires_in_seconds | int4 | type/Integer | type/Category | no | no |  |
| expires_at | timestamp | type/DateTime |  | no | no |  |
| metadata | jsonb | type/JSON | type/SerializedJSON | no | no |  |
| vid_authorization_mode | varchar | type/Text | type/Author | no | no |  |

### public.report_queue

- Table ID: 43
- Display name: Report Queue
- Entity type: entity/GenericTable
- Field count: 22
- Estimated row count: 0

| Column | DB Type | Base Type | Semantic Type | Required | Indexed | FK |
| --- | --- | --- | --- | --- | --- | --- |
| criteria → created_date_range → end | timestamp | type/DateTime | type/CreationTimestamp | no | no |  |
| criteria → created_date_range → start | timestamp | type/DateTime | type/CreationTimestamp | no | no |  |
| criteria → end_date_time | text | type/Text | type/Category | no | no |  |
| criteria → format | text | type/Text | type/Category | no | no |  |
| criteria → invoice_id | text | type/Text | type/Category | no | no |  |
| criteria → organization_id | text | type/Text | type/Category | no | no |  |
| criteria → q | text | type/Text | type/Category | no | no |  |
| criteria → request_user_id | text | type/Text | type/Category | no | no |  |
| criteria → settled_date_range → end | timestamp | type/DateTime |  | no | no |  |
| criteria → settled_date_range → start | timestamp | type/DateTime | type/CreationTimestamp | no | no |  |
| criteria → start_date_range → end | timestamp | type/DateTime | type/CreationTimestamp | no | no |  |
| criteria → start_date_range → start | timestamp | type/DateTime | type/CreationTimestamp | no | no |  |
| criteria → start_date_time | text | type/Text | type/Category | no | no |  |
| criteria → status | text | type/Text | type/Category | no | no |  |
| id | uuid | type/UUID | type/PK | no | yes |  |
| created_at | timestamp | type/DateTime | type/CreationTimestamp | no | no |  |
| updated_at | timestamp | type/DateTime | type/UpdatedTimestamp | no | no |  |
| processed_at | timestamp | type/DateTime |  | no | no |  |
| criteria | jsonb | type/JSON | type/SerializedJSON | yes | no |  |
| template_name | varchar | type/Text | type/Category | yes | no |  |
| requested_by_id | uuid | type/UUID | type/FK | no | no | users.id |
| object_key | varchar | type/Text |  | no | no |  |

### public.rever_tyc_records

- Table ID: 112
- Display name: Rever Tyc Records
- Entity type: entity/GenericTable
- Field count: 9
- Estimated row count: 0

| Column | DB Type | Base Type | Semantic Type | Required | Indexed | FK |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | type/UUID | type/PK | no | yes |  |
| created_at | timestamp | type/DateTime | type/CreationTimestamp | no | no |  |
| updated_at | timestamp | type/DateTime | type/UpdatedTimestamp | no | no |  |
| vin | varchar | type/Text | type/Category | yes | yes |  |
| choice | varchar | type/Text | type/Category | yes | no |  |
| selected_at | timestamp | type/DateTime |  | yes | no |  |
| sent_at | timestamp | type/DateTime |  | no | no |  |
| privilege_code_id | uuid | type/UUID | type/FK | no | yes | privilege_codes.id |
| user_id | uuid | type/UUID | type/FK | yes | no | users.id |

### public.settings

- Table ID: 34
- Display name: Settings
- Entity type: entity/GenericTable
- Field count: 27
- Estimated row count: 0

| Column | DB Type | Base Type | Semantic Type | Required | Indexed | FK |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | type/UUID | type/PK | no | yes |  |
| setting → app_name | text | type/Text | type/Category | no | no |  |
| setting → card_payment_provider | text | type/Text | type/Category | no | no |  |
| setting → description | text | type/Text | type/Description | no | no |  |
| setting → email | text | type/Text | type/Category | no | no |  |
| setting → en | text | type/Text | type/Category | no | no |  |
| setting → evaluation_cycle → end_date | text | type/Text | type/Category | no | no |  |
| setting → evaluation_cycle → start_date | text | type/Text | type/Category | no | no |  |
| setting → evaluation_duration_in_months | bigint | type/Integer | type/Duration | no | no |  |
| setting → hard_version | text | type/Text | type/Category | no | no |  |
| setting → help | text | type/Text | type/Category | no | no |  |
| setting → help_url | text | type/Text | type/URL | no | no |  |
| setting → ignored_fingerprints | text | type/Array |  | no | no |  |
| setting → is_maintenance | boolean | type/Boolean | type/Category | no | no |  |
| setting → maintenance_message_en | text | type/Text | type/Category | no | no |  |
| setting → maintenance_message_th | text | type/Text | type/Category | no | no |  |
| setting → max_active_payment_methods_per_card | bigint | type/Integer | type/Category | no | no |  |
| setting → phone | text | type/Text | type/Category | no | no |  |
| setting → review_version | text | type/Text | type/Category | no | no |  |
| setting → soft_version | text | type/Text | type/Category | no | no |  |
| setting → store_url | text | type/Text | type/URL | no | no |  |
| setting → th | text | type/Text | type/Category | no | no |  |
| setting → top_up_session_provider | text | type/Text | type/Category | no | no |  |
| created_at | timestamp | type/DateTime | type/CreationTimestamp | no | no |  |
| updated_at | timestamp | type/DateTime | type/UpdatedTimestamp | no | no |  |
| section | varchar | type/Text | type/Category | no | no |  |
| setting | jsonb | type/JSON | type/SerializedJSON | no | no |  |

### public.tax_credentials

- Table ID: 38
- Display name: Tax Credentials
- Entity type: entity/GenericTable
- Field count: 7
- Estimated row count: 0

| Column | DB Type | Base Type | Semantic Type | Required | Indexed | FK |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | type/UUID | type/PK | no | yes |  |
| created_at | timestamp | type/DateTime | type/CreationTimestamp | no | no |  |
| updated_at | timestamp | type/DateTime | type/UpdatedTimestamp | no | no |  |
| tax_number | varchar | type/Text | type/Category | yes | no |  |
| client_id | varchar | type/Text | type/Category | yes | no |  |
| client_secret | varchar | type/Text | type/Category | yes | no |  |
| operator_id | uuid | type/UUID | type/FK | no | yes | ocpi_operators.id |

### public.tax_information

- Table ID: 98
- Display name: Tax Information
- Entity type: entity/GenericTable
- Field count: 17
- Estimated row count: 0

| Column | DB Type | Base Type | Semantic Type | Required | Indexed | FK |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | type/UUID | type/PK | no | yes |  |
| created_at | timestamp | type/DateTime | type/CreationTimestamp | no | no |  |
| updated_at | timestamp | type/DateTime | type/UpdatedTimestamp | no | no |  |
| first_name | varchar | type/Text | type/Name | no | no |  |
| last_name | varchar | type/Text | type/Name | no | no |  |
| organization_name | varchar | type/Text | type/Category | no | no |  |
| tax_number | varchar | type/Text |  | yes | no |  |
| address | varchar | type/Text |  | yes | no |  |
| sub_district | varchar | type/Text |  | yes | no |  |
| district | varchar | type/Text |  | yes | no |  |
| province | varchar | type/Text |  | yes | no |  |
| zipcode | varchar | type/Text | type/ZipCode | yes | no |  |
| receive_tax_invoice | bool | type/Boolean | type/Category | yes | no |  |
| type | varchar | type/Text | type/Category | yes | no |  |
| user_id | uuid | type/UUID | type/FK | no | yes | users.id |
| branch_code | varchar | type/Text | type/Category | no | no |  |
| deleted_at | timestamp | type/DateTime | type/DeletionTimestamp | no | no |  |

### public.the1_verifications

- Table ID: 75
- Display name: The1 Verifications
- Entity type: entity/GenericTable
- Field count: 7
- Estimated row count: 0

| Column | DB Type | Base Type | Semantic Type | Required | Indexed | FK |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | type/UUID | type/PK | no | yes |  |
| created_at | timestamp | type/DateTime |  | no | no |  |
| updated_at | timestamp | type/DateTime |  | no | no |  |
| card_number | varchar | type/Text |  | no | yes |  |
| otp_sys_id | varchar | type/Text |  | no | no |  |
| otp_ref_text | varchar | type/Text |  | no | no |  |
| mobile_phone | varchar | type/Text |  | no | no |  |

### public.top_up_sessions

- Table ID: 106
- Display name: Top Up Sessions
- Entity type: entity/GenericTable
- Field count: 25
- Estimated row count: 0

| Column | DB Type | Base Type | Semantic Type | Required | Indexed | FK |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | type/UUID | type/PK | no | yes |  |
| metadata → debug_url | text | type/Text | type/URL | no | no |  |
| metadata → error → code | text | type/Text | type/Category | no | no |  |
| metadata → error → message | text | type/Text | type/Category | no | no |  |
| metadata → image_url | text | type/Text | type/URL | no | no |  |
| metadata → next_action → promptpay_display_qr_code → data | text | type/Text | type/URL | no | no |  |
| metadata → next_action → promptpay_display_qr_code → hosted_instructions_url | text | type/Text | type/URL | no | no |  |
| metadata → next_action → promptpay_display_qr_code → image_url_png | text | type/Text | type/URL | no | no |  |
| metadata → next_action → promptpay_display_qr_code → image_url_svg | text | type/Text | type/URL | no | no |  |
| metadata → next_action → type | text | type/Text | type/Category | no | no |  |
| metadata → type | text | type/Text | type/Category | no | no |  |
| created_at | timestamp | type/DateTime | type/CreationTimestamp | no | no |  |
| updated_at | timestamp | type/DateTime | type/UpdatedTimestamp | no | no |  |
| user_id | uuid | type/UUID | type/FK | yes | no | users.id |
| payment_method_id | uuid | type/UUID | type/FK | yes | yes | payment_methods.id |
| transaction_id | varchar | type/Text |  | no | no |  |
| reference_id | varchar | type/Text | type/Category | no | yes |  |
| status | varchar | type/Text | type/Category | yes | yes |  |
| metadata | jsonb | type/JSON | type/SerializedJSON | no | no |  |
| amount | int4 | type/Integer | type/Category | yes | no |  |
| etax_invoice_number | varchar | type/Text |  | yes | yes |  |
| etax_status | varchar | type/Text |  | no | no |  |
| settled_at | timestamp | type/DateTime |  | no | no |  |
| etax_document_type_no | varchar | type/Text | type/Category | no | no |  |
| provider | varchar | type/Text | type/Category | yes | no |  |

### public.users

- Table ID: 52
- Display name: Users
- Entity type: entity/UserTable
- Field count: 26
- Estimated row count: 0

| Column | DB Type | Base Type | Semantic Type | Required | Indexed | FK |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | type/UUID | type/PK | no | yes |  |
| created_at | timestamp | type/DateTime | type/CreationTimestamp | no | no |  |
| updated_at | timestamp | type/DateTime | type/UpdatedTimestamp | no | no |  |
| email | varchar | type/Text | type/Email | no | yes |  |
| password | varchar | type/Text |  | no | no |  |
| first_name | varchar | type/Text | type/Name | no | no |  |
| last_name | varchar | type/Text | type/Name | no | no |  |
| mobile_phone | varchar | type/Text |  | no | no |  |
| mobile_phone_verified | bool | type/Boolean | type/Category | yes | no |  |
| location | varchar | type/Text |  | no | no |  |
| partner_integrations | jsonb | type/JSON | type/SerializedJSON | yes | no |  |
| distance | varchar | type/Text | type/Category | no | no |  |
| profile_image_url | varchar | type/Text | type/URL | no | no |  |
| background_image_url | varchar | type/Text | type/URL | no | no |  |
| facebook_id | varchar | type/Text |  | no | no |  |
| facebook_profile | varchar | type/Text |  | no | no |  |
| last_logged_in_at | timestamptz | type/DateTimeWithLocalTZ |  | no | no |  |
| is_verified | bool | type/Boolean | type/Category | yes | no |  |
| completed_profile | timestamp | type/DateTime |  | no | no |  |
| deleted_at | timestamp | type/DateTime | type/DeletionTimestamp | no | no |  |
| language | varchar | type/Text | type/Category | yes | no |  |
| country_code | varchar | type/Text | type/Country | yes | no |  |
| roles | jsonb | type/JSON | type/SerializedJSON | no | no |  |
| tenant | varchar | type/Text | type/Category | no | no |  |
| is_email_verified | bool | type/Boolean | type/Category | yes | no |  |
| primary_phone_number_id | uuid | type/UUID |  | no | yes |  |

### public.users_customer_groups

- Table ID: 77
- Display name: Users Customer Groups
- Entity type: entity/UserTable
- Field count: 2
- Estimated row count: 0

| Column | DB Type | Base Type | Semantic Type | Required | Indexed | FK |
| --- | --- | --- | --- | --- | --- | --- |
| user_id | uuid | type/UUID | type/FK | yes | yes | users.id |
| customer_group_id | uuid | type/UUID | type/FK | yes | yes | customer_groups.id |

### public.users_devices

- Table ID: 118
- Display name: Users Devices
- Entity type: entity/UserTable
- Field count: 4
- Estimated row count: 0

| Column | DB Type | Base Type | Semantic Type | Required | Indexed | FK |
| --- | --- | --- | --- | --- | --- | --- |
| created_at | timestamp | type/DateTime | type/CreationTimestamp | no | no |  |
| updated_at | timestamp | type/DateTime | type/UpdatedTimestamp | no | no |  |
| device_id | uuid | type/UUID | type/FK | yes | yes | devices.id |
| user_id | uuid | type/UUID | type/FK | yes | yes | users.id |

### public.users_favorite_locations

- Table ID: 36
- Display name: Users Favorite Locations
- Entity type: entity/UserTable
- Field count: 2
- Estimated row count: 0

| Column | DB Type | Base Type | Semantic Type | Required | Indexed | FK |
| --- | --- | --- | --- | --- | --- | --- |
| location_id | uuid | type/UUID | type/FK | yes | yes | ocpi_locations.id |
| user_id | uuid | type/UUID | type/FK | yes | yes | users.id |

### public.users_phone_numbers

- Table ID: 121
- Display name: Users Phone Numbers
- Entity type: entity/UserTable
- Field count: 4
- Estimated row count: 0

| Column | DB Type | Base Type | Semantic Type | Required | Indexed | FK |
| --- | --- | --- | --- | --- | --- | --- |
| created_at | timestamp | type/DateTime | type/CreationTimestamp | no | no |  |
| updated_at | timestamp | type/DateTime | type/UpdatedTimestamp | no | no |  |
| phone_number_id | uuid | type/UUID | type/FK | yes | yes | phone_numbers.id |
| user_id | uuid | type/UUID | type/FK | yes | no | users.id |

### public.vin_pool

- Table ID: 68
- Display name: Vin Pool
- Entity type: entity/GenericTable
- Field count: 7
- Estimated row count: 0

| Column | DB Type | Base Type | Semantic Type | Required | Indexed | FK |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | type/UUID | type/PK | no | yes |  |
| created_at | timestamp | type/DateTime | type/CreationTimestamp | no | no |  |
| updated_at | timestamp | type/DateTime | type/UpdatedTimestamp | no | no |  |
| vin | varchar | type/Text |  | yes | yes |  |
| customer_group_slug | varchar | type/Text | type/Category | no | no |  |
| car_model_name | varchar | type/Text | type/Category | yes | no |  |
| tier_slug | varchar | type/Text |  | no | no |  |

### public.wallet_transactions

- Table ID: 63
- Display name: Wallet Transactions
- Entity type: entity/TransactionTable
- Field count: 9
- Estimated row count: 0

| Column | DB Type | Base Type | Semantic Type | Required | Indexed | FK |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | type/UUID | type/PK | no | yes |  |
| created_at | timestamp | type/DateTime | type/CreationTimestamp | no | no |  |
| updated_at | timestamp | type/DateTime | type/UpdatedTimestamp | no | no |  |
| amount | int4 | type/Integer |  | yes | no |  |
| payment_method_id | uuid | type/UUID | type/FK | no | yes | payment_methods.id |
| status | varchar | type/Text | type/Category | yes | no |  |
| type | varchar | type/Text | type/Category | yes | no |  |
| title | varchar | type/Text | type/Title | no | no |  |
| description | varchar | type/Text | type/Description | no | no |  |

