# Arweave Tags Schema

This document defines the tags used for Arweave uploads in the SljivaStore/Nomin system.

## Transaction Uploads

All transaction uploads (MINT, LISTING_CREATE, LISTING_CANCEL, NFT_BUY, GIFT_CREATE, GIFT_CLAIM, GIFT_REFUSE, GIFT_CANCEL, UPLOAD) include the following tags:

| Tag Name | Value | Description |
|----------|-------|-------------|
| `Content-Type` | `application/json` | MIME type of the transaction data |
| `App-Name` | `Nomin-Insite-V11` | Application identifier and version |
| `Transaction-Number` | `<number>` | Sequential transaction number |
| `Transaction-Type` | `<type>` | Transaction type (MINT, LISTING_CREATE, NFT_BUY, etc.) |

## Image Uploads

All image uploads (photographer uploads) include the following tags:

| Tag Name | Value | Description |
|----------|-------|-------------|
| `Content-Type` | `image/jpeg` | MIME type of the image |
| `Protocol-Version` | `Continental-2.1` | Protocol version identifier |
| `Asset-Type` | `RWA-Sovereign-Node` | Type of asset being uploaded |
| `Parity-Target` | `YRT-SDR` | Parity target identifier |
| `Fleg-Status` | `Active` | Status flag for the asset |
| `App-Name` | `Nomin-Insite-V11` | Application identifier and version |
| `App-Version` | `1.0` | Application version (for ArDrive compatibility) |
| `Type` | `file` | File type (for ArDrive compatibility) |
| `File-Name` | `<filename>` | Original filename (if provided) |

## Notes

- Tags are case-sensitive
- All tag values are strings
- Transaction numbers are converted to strings when added as tags
- File names are optional and only added if provided

