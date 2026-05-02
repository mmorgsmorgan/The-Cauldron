import pool from "./pool";

/**
 * Ensure the database schema exists.
 * Safe to call multiple times — uses IF NOT EXISTS.
 */
export async function ensureSchema() {
  const client = await pool.connect();
  try {
    await client.query(`
      -- Indexer state (tracks last processed block)
      CREATE TABLE IF NOT EXISTS indexer_state (
        id          INTEGER PRIMARY KEY DEFAULT 1,
        last_block  BIGINT NOT NULL DEFAULT 0,
        updated_at  TIMESTAMPTZ DEFAULT NOW()
      );

      INSERT INTO indexer_state (id, last_block)
      VALUES (1, 0)
      ON CONFLICT (id) DO NOTHING;

      -- Collections (factory-deployed or discovered)
      CREATE TABLE IF NOT EXISTS collections (
        address       TEXT PRIMARY KEY,
        name          TEXT,
        symbol        TEXT,
        deployer      TEXT,
        max_supply    BIGINT,
        base_uri      TEXT,
        is_verified   BOOLEAN DEFAULT FALSE,
        created_at    TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_collections_deployer ON collections(deployer);

      -- NFT ownership (core table for chain-wide visibility)
      CREATE TABLE IF NOT EXISTS nfts (
        id              BIGSERIAL PRIMARY KEY,
        contract        TEXT NOT NULL,
        token_id        TEXT NOT NULL,
        owner           TEXT NOT NULL,
        token_uri       TEXT,
        metadata        JSONB,
        metadata_status TEXT DEFAULT 'pending',
        last_updated    TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(contract, token_id)
      );

      CREATE INDEX IF NOT EXISTS idx_nfts_owner ON nfts(LOWER(owner));
      CREATE INDEX IF NOT EXISTS idx_nfts_contract ON nfts(LOWER(contract));
      CREATE INDEX IF NOT EXISTS idx_nfts_status ON nfts(metadata_status);

      -- Marketplace listings
      CREATE TABLE IF NOT EXISTS listings (
        id          BIGSERIAL PRIMARY KEY,
        contract    TEXT NOT NULL,
        token_id    TEXT NOT NULL,
        seller      TEXT NOT NULL,
        price       NUMERIC NOT NULL,
        active      BOOLEAN DEFAULT TRUE,
        listed_at   TIMESTAMPTZ DEFAULT NOW(),
        sold_at     TIMESTAMPTZ,
        buyer       TEXT,
        UNIQUE(contract, token_id, seller, listed_at)
      );

      CREATE INDEX IF NOT EXISTS idx_listings_seller ON listings(LOWER(seller));
      CREATE INDEX IF NOT EXISTS idx_listings_active ON listings(active);
      CREATE INDEX IF NOT EXISTS idx_listings_contract ON listings(LOWER(contract));

      -- Transfer history (for analytics / provenance)
      CREATE TABLE IF NOT EXISTS transfers (
        id          BIGSERIAL PRIMARY KEY,
        contract    TEXT NOT NULL,
        token_id    TEXT NOT NULL,
        from_addr   TEXT NOT NULL,
        to_addr     TEXT NOT NULL,
        block_number BIGINT NOT NULL,
        tx_hash     TEXT NOT NULL,
        timestamp   TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_transfers_contract_token ON transfers(contract, token_id);
    `);
  } finally {
    client.release();
  }
}
