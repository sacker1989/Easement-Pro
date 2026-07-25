import { resolveAddress } from '@/lib/parcel-resolution';

interface SearchPageProps {
  searchParams: Record<string, string | string[] | undefined>;
}

function param(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}

/**
 * Minimal, functional demo of the Step 1 module (address/APN resolution +
 * LA County fallback routing). This is not the UX Agent's polished search
 * flow — it exists to prove the lib/parcel-resolution pipeline end to end
 * behind a real route before the rest of the app is built out.
 */
export default async function SearchPage({ searchParams }: SearchPageProps) {
  const street = param(searchParams.street);
  const city = param(searchParams.city);
  const state = param(searchParams.state);
  const zip = param(searchParams.zip);

  const hasQuery = Boolean(street && city && state && zip);

  let result: Awaited<ReturnType<typeof resolveAddress>> | null = null;
  let error: string | null = null;

  if (hasQuery) {
    try {
      result = await resolveAddress({ street, city, state, zip });
    } catch (err) {
      error = err instanceof Error ? err.message : 'Unknown error';
    }
  }

  return (
    <main>
      <h1>Address / APN Search</h1>
      <form>
        <div>
          <label>
            Street <input name="street" defaultValue={street} required />
          </label>
        </div>
        <div>
          <label>
            City <input name="city" defaultValue={city} required />
          </label>
        </div>
        <div>
          <label>
            State <input name="state" defaultValue={state} maxLength={2} required />
          </label>
        </div>
        <div>
          <label>
            ZIP <input name="zip" defaultValue={zip} required />
          </label>
        </div>
        <button type="submit">Search</button>
      </form>

      {error && <p role="alert">{error}</p>}

      {result && (
        <pre>{JSON.stringify(result, null, 2)}</pre>
      )}
    </main>
  );
}
