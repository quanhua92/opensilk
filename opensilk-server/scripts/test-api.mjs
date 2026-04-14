const BASE = process.argv[2] || process.env.API_URL || 'http://localhost:8080';
let cookie = '';
let bearerToken = '';
let workspaceId = '';
let passed = 0;
let failed = 0;

async function fetchJSON(path, opts = {}) {
    const res = await fetch(`${BASE}${path}`, {
        headers: {
            'Content-Type': 'application/json',
            ...(cookie ? { Cookie: cookie } : {}),
            ...opts.headers,
        },
        ...opts,
    });
    const setCookie = res.headers.get('set-cookie');
    if (setCookie) {
        cookie = setCookie.split(';')[0];
        // Extract raw token from cookie for Bearer tests
        const tokenMatch = cookie.match(/^access_token=(.+)$/);
        if (tokenMatch) bearerToken = tokenMatch[1];
    }
    const text = await res.text().catch(() => '');
    let data = null;
    try { data = JSON.parse(text); } catch {}
    return { status: res.status, data, headers: res.headers };
}

function assert(condition, msg) {
    if (condition) {
        console.log(`  ✓ ${msg}`);
        passed++;
    } else {
        console.log(`  ✗ ${msg}`);
        failed++;
    }
}

async function run() {
    console.log('opensilk-server endpoint tests\n');

    // 1. Health
    console.log('GET /health');
    const health = await fetchJSON('/health');
    // health returns plain text "ok", not JSON
    assert(health.status === 200, `returns 200`);
    console.log();

    // 2. Register
    console.log('POST /auth/register');
    const email = `test-${Date.now()}@example.com`;
    const reg = await fetchJSON('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, password: 'secret123', full_name: 'Test User' }),
    });
    assert(reg.status === 201, `returns 201`);
    assert(reg.data?.id != null, `has id field`);
    assert(reg.data?.email === email, `email matches`);
    assert(reg.data?.password_hash == null, `no password_hash in response`);
    console.log();

    // 3. Duplicate register
    console.log('POST /auth/register (duplicate)');
    const dup = await fetchJSON('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, password: 'secret123', full_name: 'Dup' }),
    });
    assert(dup.status === 409, `returns 409`);
    assert(dup.data?.error === 409, `error field is 409`);
    console.log();

    // 4. Login
    console.log('POST /auth/login');
    const login = await fetchJSON('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password: 'secret123' }),
    });
    assert(login.status === 200, `returns 200`);
    assert(login.data?.id != null, `has id field`);
    assert(cookie !== '', `Set-Cookie header present (access_token=...)`);
    console.log();

    // 5. Create workspace
    console.log('POST /workspaces');
    const ws = await fetchJSON('/workspaces', {
        method: 'POST',
        body: JSON.stringify({ name: 'Test Workspace' }),
    });
    assert(ws.status === 201, `returns 201`);
    assert(ws.data?.id != null, `has id field`);
    assert(ws.data?.name === 'Test Workspace', `name matches`);
    workspaceId = ws.data?.id;
    console.log();

    // 6. List workspaces
    console.log('GET /workspaces');
    const list = await fetchJSON('/workspaces');
    assert(list.status === 200, `returns 200`);
    assert(Array.isArray(list.data), `returns array`);
    assert(list.data.length >= 1, `has at least 1 workspace`);
    console.log();

    // 7. Get workspace by id
    console.log(`GET /workspaces/${workspaceId}`);
    const get = await fetchJSON(`/workspaces/${workspaceId}`);
    assert(get.status === 200, `returns 200`);
    assert(get.data?.id === workspaceId, `id matches`);
    console.log();

    // 8. Unauthenticated access
    console.log('GET /workspaces (no cookie)');
    const origCookie = cookie;
    cookie = '';
    const unauth = await fetchJSON('/workspaces');
    cookie = origCookie;
    assert(unauth.status === 401, `returns 401`);
    console.log();

    // 9. Bearer token auth
    console.log('GET /workspaces (Bearer token, no cookie)');
    cookie = '';
    const bearer = await fetchJSON('/workspaces', {
        headers: { Authorization: `Bearer ${bearerToken}` },
    });
    cookie = origCookie;
    assert(bearer.status === 200, `returns 200`);
    assert(Array.isArray(bearer.data), `returns array`);
    assert(bearer.data.length >= 1, `has at least 1 workspace`);
    console.log();

    // Summary
    console.log(`\nResults: ${passed} passed, ${failed} failed`);
    process.exit(failed > 0 ? 1 : 0);
}

run().catch(err => {
    console.error('Test runner error:', err);
    process.exit(1);
});
