import pool from "./pool";

// ──────────────────────────────────────────────
//  NFTs
// ──────────────────────────────────────────────

export async function upsertNFT(
  contract: string,
  tokenId: string,
  owner: string
) {
  await pool.query(
    `INSERT INTO nfts (contract, token_id, owner, last_updated)
     VALUES (LOWER($1), $2, LOWER($3), NOW())
     ON CONFLICT (contract, token_id)
     DO UPDATE SET owner = LOWER($3), last_updated = NOW()`,
    [contract, tokenId, owner]
  );
}

export async function updateMetadata(
  contract: string,
  tokenId: string,
  tokenUri: string | null,
  metadata: object | null,
  status: string
) {
  await pool.query(
    `UPDATE nfts
     SET token_uri = $3, metadata = $4, metadata_status = $5, last_updated = NOW()
     WHERE contract = LOWER($1) AND token_id = $2`,
    [contract, tokenId, tokenUri, metadata ? JSON.stringify(metadata) : null, status]
  );
}

export async function getNFTsByOwner(owner: string, verifiedOnly: boolean = false) {
  let query = `
    SELECT n.contract, n.token_id, n.owner, n.token_uri, n.metadata,
           n.metadata_status, n.last_updated,
           c.name AS collection_name, c.symbol AS collection_symbol,
           c.is_verified
    FROM nfts n
    LEFT JOIN collections c ON LOWER(c.address) = LOWER(n.contract)
    WHERE LOWER(n.owner) = LOWER($1)
  `;
  if (verifiedOnly) {
    query += ` AND c.is_verified = TRUE`;
  }
  query += ` ORDER BY n.last_updated DESC`;

  const result = await pool.query(query, [owner]);
  return result.rows;
}

export async function getNFTsPendingMetadata(limit: number = 50) {
  const result = await pool.query(
    `SELECT contract, token_id FROM nfts
     WHERE metadata_status = 'pending'
     ORDER BY last_updated ASC
     LIMIT $1`,
    [limit]
  );
  return result.rows;
}

// ──────────────────────────────────────────────
//  Collections
// ──────────────────────────────────────────────

export async function upsertCollection(
  address: string,
  name: string,
  symbol: string,
  deployer: string,
  maxSupply: number,
  baseUri: string,
  isVerified: boolean
) {
  await pool.query(
    `INSERT INTO collections (address, name, symbol, deployer, max_supply, base_uri, is_verified, created_at)
     VALUES (LOWER($1), $2, $3, LOWER($4), $5, $6, $7, NOW())
     ON CONFLICT (address)
     DO UPDATE SET name = $2, symbol = $3, base_uri = $6, is_verified = $7`,
    [address, name, symbol, deployer, maxSupply, baseUri, isVerified]
  );
}

export async function getCollections() {
  const result = await pool.query(
    `SELECT * FROM collections ORDER BY created_at DESC`
  );
  return result.rows;
}

export async function getCollectionByAddress(address: string) {
  const result = await pool.query(
    `SELECT * FROM collections WHERE LOWER(address) = LOWER($1)`,
    [address]
  );
  return result.rows[0] || null;
}

export async function getCollectionTokens(address: string) {
  const result = await pool.query(
    `SELECT * FROM nfts WHERE LOWER(contract) = LOWER($1) ORDER BY CAST(token_id AS INTEGER)`,
    [address]
  );
  return result.rows;
}

// ──────────────────────────────────────────────
//  Listings
// ──────────────────────────────────────────────

export async function insertListing(
  contract: string,
  tokenId: string,
  seller: string,
  price: string
) {
  await pool.query(
    `INSERT INTO listings (contract, token_id, seller, price, active, listed_at)
     VALUES (LOWER($1), $2, LOWER($3), $4, TRUE, NOW())`,
    [contract, tokenId, seller, price]
  );
}

export async function deactivateListing(contract: string, tokenId: string) {
  await pool.query(
    `UPDATE listings SET active = FALSE WHERE LOWER(contract) = LOWER($1) AND token_id = $2 AND active = TRUE`,
    [contract, tokenId]
  );
}

export async function markListingSold(
  contract: string,
  tokenId: string,
  buyer: string
) {
  await pool.query(
    `UPDATE listings
     SET active = FALSE, sold_at = NOW(), buyer = LOWER($3)
     WHERE LOWER(contract) = LOWER($1) AND token_id = $2 AND active = TRUE`,
    [contract, tokenId, buyer]
  );
}

export async function getActiveListings(limit: number = 50, offset: number = 0) {
  const result = await pool.query(
    `SELECT l.*, c.name AS collection_name, c.is_verified,
            n.metadata, n.metadata_status
     FROM listings l
     LEFT JOIN collections c ON LOWER(c.address) = LOWER(l.contract)
     LEFT JOIN nfts n ON LOWER(n.contract) = LOWER(l.contract) AND n.token_id = l.token_id
     WHERE l.active = TRUE
     ORDER BY l.listed_at DESC
     LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  return result.rows;
}

export async function getListingsBySeller(seller: string) {
  const result = await pool.query(
    `SELECT l.*, c.name AS collection_name
     FROM listings l
     LEFT JOIN collections c ON LOWER(c.address) = LOWER(l.contract)
     WHERE LOWER(l.seller) = LOWER($1) AND l.active = TRUE
     ORDER BY l.listed_at DESC`,
    [seller]
  );
  return result.rows;
}

// ──────────────────────────────────────────────
//  Transfers
// ──────────────────────────────────────────────

export async function insertTransfer(
  contract: string,
  tokenId: string,
  from: string,
  to: string,
  blockNumber: number,
  txHash: string
) {
  await pool.query(
    `INSERT INTO transfers (contract, token_id, from_addr, to_addr, block_number, tx_hash, timestamp)
     VALUES (LOWER($1), $2, LOWER($3), LOWER($4), $5, $6, NOW())`,
    [contract, tokenId, from, to, blockNumber, txHash]
  );
}

// ──────────────────────────────────────────────
//  Indexer State
// ──────────────────────────────────────────────

export async function getLastIndexedBlock(): Promise<number> {
  const result = await pool.query(`SELECT last_block FROM indexer_state WHERE id = 1`);
  return result.rows[0]?.last_block || 0;
}

export async function setLastIndexedBlock(block: number) {
  await pool.query(
    `UPDATE indexer_state SET last_block = $1, updated_at = NOW() WHERE id = 1`,
    [block]
  );
}
