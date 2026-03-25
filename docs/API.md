# CVE Service API Documentation

Base URL: `http://localhost:3000`

## 1) List CVEs

- Method: `GET`
- Path: `/api/cves`

### Query Parameters

- `page` (integer, default `1`)
- `limit` (integer, one of `10`, `50`, `100`, max supported `100`)
- `cveId` (string, partial match supported)
- `year` (integer, e.g. `2024`)
- `score` (number, exact base score)
- `scoreMin` (number)
- `scoreMax` (number)
- `modifiedWithinDays` (integer, e.g. `30`)
- `sortBy` (`published` or `lastModified`)
- `sortOrder` (`asc` or `desc`)

### Success Response

```json
{
  "totalRecords": 29999,
  "page": 1,
  "limit": 10,
  "totalPages": 3000,
  "records": [
    {
      "cveId": "CVE-2024-12345",
      "sourceIdentifier": "cve@mitre.org",
      "publishedAt": "2024-01-01T00:00:00.000Z",
      "lastModifiedAt": "2024-01-03T00:00:00.000Z",
      "vulnStatus": "Analyzed",
      "cvssV2Score": 5,
      "cvssV3Score": 8.8,
      "baseScore": 8.8
    }
  ]
}
```

## 2) CVE Detail

- Method: `GET`
- Path: `/api/cves/:cveId`

### Success Response

Returns full CVE detail from local DB including description, metrics, references, configurations, and raw source payload.

## 3) Trigger Sync

- Method: `POST`
- Path: `/api/sync`

### Request Body

```json
{
  "mode": "incremental",
  "maxPages": 2
}
```

- `mode`: `incremental` or `full`
- `maxPages`: optional guard to cap sync pages for demo/fast runs

## 4) Sync State

- Method: `GET`
- Path: `/api/sync/state`

Returns scheduler and last-run metadata.

## 5) Health Endpoint

- Method: `GET`
- Path: `/api/health`

Basic liveness response.
