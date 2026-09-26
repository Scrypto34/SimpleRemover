(async () => {
  const keep = ["USER1", "USER2", "USER3"].map(n => n.toLowerCase());
  const delay = 1500;
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  let token = "";
  const call = async (url, opts = {}) => {
    const go = () => fetch(url, {
      credentials: "include",
      ...opts,
      headers: { "Content-Type": "application/json", "x-csrf-token": token }
    });
    let res = await go();
    if (res.status === 403 && res.headers.get("x-csrf-token")) {
      token = res.headers.get("x-csrf-token");
      res = await go();
    }
    return res;
  };

  const { id: myId } = await (await call("https://users.roblox.com/v1/users/authenticated")).json();

  let ids = [], cursor = "";
  do {
    const page = await (await call(`https://friends.roblox.com/v1/users/${myId}/friends/find?limit=50&cursor=${encodeURIComponent(cursor)}`)).json();
    ids.push(...(page.PageItems || []).map(p => p.id));
    cursor = page.HasMore ? page.NextCursor : "";
  } while (cursor);

  let friends = [];
  for (let i = 0; i < ids.length; i += 100) {
    const res = await call("https://users.roblox.com/v1/users", {
      method: "POST",
      body: JSON.stringify({ userIds: ids.slice(i, i + 100), excludeBannedUsers: false })
    });
    friends.push(...((await res.json()).data || []));
  }

  const missing = ids.filter(id => !friends.find(f => f.id === id));
  const toRemove = friends.filter(f => f.name && !keep.includes(f.name.toLowerCase()));

  console.log(`${ids.length} friends, removing ${toRemove.length}`, toRemove.map(f => f.name));
  if (missing.length) console.warn("couldn't get names for:", missing);
  if (!confirm(`Remove ${toRemove.length}/${ids.length} friends?`)) return;

  for (const f of toRemove) {
    const res = await call(`https://friends.roblox.com/v1/users/${f.id}/unfriend`, { method: "POST" });
    console.log(res.ok ? `removed ${f.name}` : `failed ${f.name} (${res.status})`);
    await sleep(delay);
  }
  console.log("done");
})();
