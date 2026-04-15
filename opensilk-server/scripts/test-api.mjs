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

    // 4b. Get current user (/auth/me with cookie)
    console.log('GET /auth/me (with cookie)');
    const me = await fetchJSON('/auth/me');
    assert(me.status === 200, `returns 200`);
    assert(me.data?.id === login.data?.id, `id matches logged-in user`);
    assert(me.data?.email === email, `email matches`);
    console.log();

    // 4c. /auth/me without cookie (should 401)
    console.log('GET /auth/me (no cookie)');
    const origCookieForMe = cookie;
    cookie = '';
    const meUnauth = await fetchJSON('/auth/me');
    cookie = origCookieForMe;
    assert(meUnauth.status === 401, `returns 401`);
    console.log();

    // 4d. /auth/me with Bearer token
    console.log('GET /auth/me (Bearer token)');
    cookie = '';
    const meBearer = await fetchJSON('/auth/me', {
        headers: { Authorization: `Bearer ${bearerToken}` },
    });
    cookie = origCookieForMe;
    assert(meBearer.status === 200, `returns 200`);
    assert(meBearer.data?.email === email, `email matches`);
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

    // 10. Create task
    console.log(`POST /workspaces/${workspaceId}/tasks`);
    const createTask = await fetchJSON(`/workspaces/${workspaceId}/tasks`, {
        method: 'POST',
        body: JSON.stringify({ type: 'workflow', name: 'hello_agents', input_data: { name: 'Test' } }),
    });
    assert(createTask.status === 201, `returns 201`);
    assert(createTask.data?.id != null, `has id`);
    assert(createTask.data?.status === 'pending', `status is pending`);
    assert(createTask.data?.type === 'workflow', `type is workflow`);
    let taskId = createTask.data?.id;
    console.log();

    // 11. List tasks
    console.log(`GET /workspaces/${workspaceId}/tasks`);
    const listTasks = await fetchJSON(`/workspaces/${workspaceId}/tasks`);
    assert(listTasks.status === 200, `returns 200`);
    assert(Array.isArray(listTasks.data), `returns array`);
    assert(listTasks.data.length >= 1, `has at least 1 task`);
    console.log();

    // 12. List tasks with status filter
    console.log(`GET /workspaces/${workspaceId}/tasks?status=pending`);
    const pendingTasks = await fetchJSON(`/workspaces/${workspaceId}/tasks?status=pending`);
    assert(pendingTasks.status === 200, `returns 200`);
    assert(Array.isArray(pendingTasks.data), `returns array`);
    assert(pendingTasks.data.every(t => t.status === 'pending'), `all tasks have status pending`);
    console.log();

    // 13. Get task by id
    console.log(`GET /workspaces/${workspaceId}/tasks/${taskId}`);
    const getTask = await fetchJSON(`/workspaces/${workspaceId}/tasks/${taskId}`);
    assert(getTask.status === 200, `returns 200`);
    assert(getTask.data?.id === taskId, `id matches`);
    console.log();

    // 14. Update task (simulate completion)
    console.log(`PATCH /workspaces/${workspaceId}/tasks/${taskId}`);
    const updateTask = await fetchJSON(`/workspaces/${workspaceId}/tasks/${taskId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'completed', output_data: { greeting: 'Hello, Test!' } }),
    });
    assert(updateTask.status === 200, `returns 200`);
    assert(updateTask.data?.status === 'completed', `status is completed`);
    assert(updateTask.data?.output_data?.greeting === 'Hello, Test!', `output_data matches`);
    console.log();

    // 15. Cancel completed task (should fail)
    console.log(`POST /workspaces/${workspaceId}/tasks/${taskId}/cancel`);
    const cancelFailed = await fetchJSON(`/workspaces/${workspaceId}/tasks/${taskId}/cancel`, {
        method: 'POST',
    });
    assert(cancelFailed.status === 404, `returns 404 (not cancellable)`);
    console.log();

    // 16. Create and cancel a pending task
    console.log(`POST /workspaces/${workspaceId}/tasks (for cancel)`);
    const cancelable = await fetchJSON(`/workspaces/${workspaceId}/tasks`, {
        method: 'POST',
        body: JSON.stringify({ type: 'agentic', name: 'test_cancel' }),
    });
    let cancelableId = cancelable.data?.id;
    console.log(`POST /workspaces/${workspaceId}/tasks/${cancelableId}/cancel`);
    const cancelOk = await fetchJSON(`/workspaces/${workspaceId}/tasks/${cancelableId}/cancel`, {
        method: 'POST',
    });
    assert(cancelOk.status === 200, `returns 200`);
    assert(cancelOk.data?.status === 'cancelled', `status is cancelled`);
    console.log();

    // 17. List task types — workflows (MCP tool registry)
    console.log(`GET /workspaces/${workspaceId}/tasks/types?type=workflow`);
    const workflows = await fetchJSON(`/workspaces/${workspaceId}/tasks/types?type=workflow`);
    assert(workflows.status === 200, `returns 200`);
    assert(Array.isArray(workflows.data?.tools), `has tools array`);
    assert(workflows.data?.tools.length >= 1, `has at least 1 workflow`);
    const wfTool = workflows.data?.tools[0];
    assert(wfTool?.name === 'hello_agents', `first tool name is hello_agents`);
    assert(typeof wfTool?.inputSchema?.type === 'string', `inputSchema has type field`);
    assert(wfTool?.inputSchema?.type === 'object', `inputSchema type is object`);
    assert(wfTool?.annotations?.title != null, `has annotations.title`);
    console.log();

    // 18. List task types — agentic (MCP tool registry)
    console.log(`GET /workspaces/${workspaceId}/tasks/types?type=agentic`);
    const agents = await fetchJSON(`/workspaces/${workspaceId}/tasks/types?type=agentic`);
    assert(agents.status === 200, `returns 200`);
    assert(Array.isArray(agents.data?.tools), `has tools array`);
    assert(agents.data?.tools.length >= 1, `has at least 1 agentic tool`);
    const agTool = agents.data?.tools[0];
    assert(agTool?.name === 'openclaw', `first tool name is openclaw`);
    assert(agTool?.annotations?.title != null, `has annotations.title`);
    console.log();

    // 19. List task types — no filter (returns all)
    console.log(`GET /workspaces/${workspaceId}/tasks/types`);
    const allTypes = await fetchJSON(`/workspaces/${workspaceId}/tasks/types`);
    assert(allTypes.status === 200, `returns 200`);
    assert(Array.isArray(allTypes.data?.tools), `has tools array`);
    assert(allTypes.data?.tools.length === 2, `returns both workflow and agentic tools`);
    const toolNames = allTypes.data?.tools.map(t => t.name);
    assert(toolNames.includes('hello_agents'), `contains hello_agents`);
    assert(toolNames.includes('openclaw'), `contains openclaw`);
    console.log();

    // --- Agent Tests ---
    console.log('POST /workspaces/{ws}/agents');
    const createAgent = await fetchJSON(`/workspaces/${workspaceId}/agents`, {
        method: 'POST',
        body: JSON.stringify({
            name: 'Test Agent',
            slug: 'test-agent',
            persona: 'You are a helpful assistant.',
            enabled_tools: ['search', 'code_review'],
        }),
    });
    assert(createAgent.status === 201, `returns 201`);
    assert(createAgent.data?.id != null, `has id`);
    assert(createAgent.data?.slug === 'test-agent', `slug matches`);
    let agentId = createAgent.data?.id;
    console.log();

    console.log('GET /workspaces/{ws}/agents');
    const listAgents = await fetchJSON(`/workspaces/${workspaceId}/agents`);
    assert(listAgents.status === 200, `returns 200`);
    assert(Array.isArray(listAgents.data), `returns array`);
    assert(listAgents.data.length >= 1, `has at least 1 agent`);
    console.log();

    console.log('GET /workspaces/{ws}/agents/{id}');
    const getAgent = await fetchJSON(`/workspaces/${workspaceId}/agents/${agentId}`);
    assert(getAgent.status === 200, `returns 200`);
    assert(getAgent.data?.id === agentId, `id matches`);
    console.log();

    console.log('PATCH /workspaces/{ws}/agents/{id}');
    const updateAgent = await fetchJSON(`/workspaces/${workspaceId}/agents/${agentId}`, {
        method: 'PATCH',
        body: JSON.stringify({ persona: 'Updated persona.' }),
    });
    assert(updateAgent.status === 200, `returns 200`);
    assert(updateAgent.data?.persona === 'Updated persona.', `persona updated`);
    console.log();

    console.log('POST /workspaces/{ws}/agents (duplicate slug)');
    const dupAgent = await fetchJSON(`/workspaces/${workspaceId}/agents`, {
        method: 'POST',
        body: JSON.stringify({ name: 'Another', slug: 'test-agent' }),
    });
    assert(dupAgent.status === 409, `returns 409 for duplicate slug`);
    console.log();

    console.log('DELETE /workspaces/{ws}/agents/{id}');
    const delAgent = await fetchJSON(`/workspaces/${workspaceId}/agents/${agentId}`, {
        method: 'DELETE',
    });
    assert(delAgent.status === 200, `returns 200`);
    console.log();

    // --- Board Tests ---
    console.log('POST /workspaces/{ws}/boards');
    const createBoard = await fetchJSON(`/workspaces/${workspaceId}/boards`, {
        method: 'POST',
        body: JSON.stringify({ name: 'Test Board', description: 'Kanban board' }),
    });
    assert(createBoard.status === 201, `returns 201`);
    assert(createBoard.data?.id != null, `has id`);
    let boardId = createBoard.data?.id;

    console.log('GET /workspaces/{ws}/boards');
    const listBoards = await fetchJSON(`/workspaces/${workspaceId}/boards`);
    assert(listBoards.status === 200, `returns 200`);
    assert(Array.isArray(listBoards.data), `returns array`);

    console.log('GET /workspaces/{ws}/boards/{id}');
    const getBoard = await fetchJSON(`/workspaces/${workspaceId}/boards/${boardId}`);
    assert(getBoard.status === 200, `returns 200`);
    assert(getBoard.data?.id === boardId, `id matches`);

    // --- Card Tests ---
    console.log('POST /workspaces/{ws}/boards/{id}/cards');
    const createCard = await fetchJSON(`/workspaces/${workspaceId}/boards/${boardId}/cards`, {
        method: 'POST',
        body: JSON.stringify({ title: 'Test Card', priority: 'high' }),
    });
    assert(createCard.status === 201, `returns 201`);
    let cardId = createCard.data?.id;
    assert(createCard.data?.status === 'inbox', `default status is inbox`);

    console.log('GET /workspaces/{ws}/boards/{id}/cards');
    const listCards = await fetchJSON(`/workspaces/${workspaceId}/boards/${boardId}/cards`);
    assert(listCards.status === 200, `returns 200`);
    assert(Array.isArray(listCards.data), `returns array`);

    console.log('PATCH /workspaces/{ws}/boards/{id}/cards/{id} (status move)');
    const moveCard = await fetchJSON(`/workspaces/${workspaceId}/boards/${boardId}/cards/${cardId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'in_progress' }),
    });
    assert(moveCard.status === 200, `returns 200`);
    assert(moveCard.data?.status === 'in_progress', `status updated`);

    // --- Comment Tests ---
    console.log('POST /workspaces/{ws}/boards/{id}/cards/{id}/comments');
    const createComment = await fetchJSON(
        `/workspaces/${workspaceId}/boards/${boardId}/cards/${cardId}/comments`,
        { method: 'POST', body: JSON.stringify({ content: 'Test comment from user' }) },
    );
    assert(createComment.status === 201, `returns 201`);
    assert(createComment.data?.author_type === 'user', `author_type is user`);

    console.log('GET /workspaces/{ws}/boards/{id}/cards/{id}/comments');
    const listComments = await fetchJSON(
        `/workspaces/${workspaceId}/boards/${boardId}/cards/${cardId}/comments`,
    );
    assert(listComments.status === 200, `returns 200`);
    assert(listComments.data?.length >= 1, `has at least 1 comment`);

    // --- Card-task linking test ---
    console.log('POST /workspaces/{ws}/tasks (with card_id)');
    const taskWithCard = await fetchJSON(`/workspaces/${workspaceId}/tasks`, {
        method: 'POST',
        body: JSON.stringify({
            type: 'workflow',
            name: 'hello_agents',
            card_id: cardId,
        }),
    });
    assert(taskWithCard.status === 201, `returns 201`);
    assert(taskWithCard.data?.card_id === cardId, `card_id linked`);
    console.log();

    // Summary
    console.log(`\nResults: ${passed} passed, ${failed} failed`);
    process.exit(failed > 0 ? 1 : 0);
}

run().catch(err => {
    console.error('Test runner error:', err);
    process.exit(1);
});
