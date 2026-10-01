import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1759200000000 implements MigrationInterface {
  name = 'InitialSchema1759200000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE EXTENSION IF NOT EXISTS btree_gist`);

    await q.query(`
      CREATE TABLE users (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        email text NOT NULL,
        password_hash text NOT NULL,
        full_name text NOT NULL,
        role text NOT NULL CHECK (role IN ('admin','reception','housekeeping','restaurant','accounting','it')),
        locale text NOT NULL DEFAULT 'fr' CHECK (locale IN ('fr','en','ar')),
        mfa_secret text,
        mfa_enabled boolean NOT NULL DEFAULT false,
        active boolean NOT NULL DEFAULT true,
        created_at timestamptz NOT NULL DEFAULT now()
      )`);
    await q.query(`CREATE UNIQUE INDEX users_email_uq ON users (lower(email))`);

    await q.query(`
      CREATE TABLE refresh_tokens (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        family_id uuid NOT NULL,
        token_hash text NOT NULL,
        expires_at timestamptz NOT NULL,
        revoked_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now()
      )`);
    await q.query(`CREATE INDEX refresh_tokens_family_idx ON refresh_tokens (family_id)`);

    await q.query(`
      CREATE TABLE navigation_items (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        key text NOT NULL UNIQUE,
        parent_key text REFERENCES navigation_items(key) ON UPDATE CASCADE ON DELETE CASCADE,
        path text,
        icon text,
        permission text,
        module text NOT NULL DEFAULT 'core',
        label_fr text NOT NULL,
        label_en text NOT NULL,
        label_ar text NOT NULL,
        sort_order int NOT NULL DEFAULT 0,
        enabled boolean NOT NULL DEFAULT true,
        version int NOT NULL DEFAULT 1,
        created_at timestamptz NOT NULL DEFAULT now()
      )`);

    await q.query(`
      CREATE TABLE room_types (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        code text NOT NULL UNIQUE,
        name text NOT NULL,
        capacity int NOT NULL CHECK (capacity > 0),
        base_price int NOT NULL CHECK (base_price >= 0),
        currency char(3) NOT NULL,
        version int NOT NULL DEFAULT 1,
        created_at timestamptz NOT NULL DEFAULT now()
      )`);

    await q.query(`
      CREATE TABLE rooms (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        number text NOT NULL UNIQUE,
        floor int,
        room_type_id uuid NOT NULL REFERENCES room_types(id),
        status text NOT NULL DEFAULT 'available' CHECK (status IN ('available','occupied','cleaning','maintenance')),
        version int NOT NULL DEFAULT 1,
        created_at timestamptz NOT NULL DEFAULT now()
      )`);
    await q.query(`CREATE INDEX rooms_type_status_idx ON rooms (room_type_id, status)`);

    await q.query(`
      CREATE TABLE guests (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        first_name text NOT NULL,
        last_name text NOT NULL,
        email text,
        phone text,
        nationality char(2),
        segment text NOT NULL DEFAULT 'individual' CHECK (segment IN ('individual','group','company')),
        preferences jsonb NOT NULL DEFAULT '{}',
        erased_at timestamptz,
        version int NOT NULL DEFAULT 1,
        created_at timestamptz NOT NULL DEFAULT now()
      )`);
    await q.query(`CREATE INDEX guests_name_idx ON guests (lower(last_name), lower(first_name))`);
    await q.query(`CREATE INDEX guests_email_idx ON guests (lower(email))`);

    await q.query(`
      CREATE TABLE reservations (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        reference text NOT NULL UNIQUE,
        guest_id uuid NOT NULL REFERENCES guests(id),
        room_type_id uuid NOT NULL REFERENCES room_types(id),
        room_id uuid REFERENCES rooms(id),
        arrival_date date NOT NULL,
        departure_date date NOT NULL,
        adults int NOT NULL CHECK (adults >= 1),
        children int NOT NULL DEFAULT 0 CHECK (children >= 0),
        board text NOT NULL CHECK (board IN ('room_only','half_board','full_board')),
        channel text NOT NULL CHECK (channel IN ('direct','phone','web','agency','ota')),
        status text NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed','checked_in','checked_out','cancelled','no_show')),
        total_amount int NOT NULL CHECK (total_amount >= 0),
        currency char(3) NOT NULL,
        notes text,
        cancel_reason text,
        cancelled_at timestamptz,
        checked_in_at timestamptz,
        checked_out_at timestamptz,
        version int NOT NULL DEFAULT 1,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT reservations_dates_chk CHECK (departure_date > arrival_date),
        -- Garde-fou ultime contre la double attribution d'une même chambre (section 3.1).
        CONSTRAINT reservations_no_room_overlap EXCLUDE USING gist (
          room_id WITH =,
          daterange(arrival_date, departure_date, '[)') WITH &&
        ) WHERE (room_id IS NOT NULL AND status IN ('confirmed','checked_in'))
      )`);
    await q.query(`CREATE INDEX reservations_stock_idx ON reservations (room_type_id, arrival_date, departure_date) WHERE status IN ('confirmed','checked_in')`);
    await q.query(`CREATE INDEX reservations_guest_idx ON reservations (guest_id)`);
    await q.query(`CREATE INDEX reservations_arrival_idx ON reservations (arrival_date, id)`);
    await q.query(`CREATE INDEX reservations_created_idx ON reservations (created_at, id)`);

    await q.query(`
      CREATE TABLE idempotency_keys (
        user_id uuid NOT NULL,
        key text NOT NULL,
        route text NOT NULL,
        request_hash text NOT NULL,
        state text NOT NULL CHECK (state IN ('processing','completed')),
        response_status int,
        response_body jsonb,
        created_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (user_id, key)
      )`);
    await q.query(`CREATE INDEX idempotency_keys_created_idx ON idempotency_keys (created_at)`);

    await q.query(`
      CREATE TABLE audit_logs (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        actor_id uuid,
        action text NOT NULL,
        entity_type text NOT NULL,
        entity_id uuid,
        data jsonb NOT NULL DEFAULT '{}',
        created_at timestamptz NOT NULL DEFAULT now()
      )`);
    await q.query(`CREATE INDEX audit_logs_entity_idx ON audit_logs (entity_type, entity_id, created_at)`);
  }

  async down(q: QueryRunner): Promise<void> {
    for (const t of ['audit_logs', 'idempotency_keys', 'reservations', 'guests', 'rooms', 'room_types', 'navigation_items', 'refresh_tokens', 'users']) {
      await q.query(`DROP TABLE IF EXISTS ${t}`);
    }
  }
}
