async function generateEmail() {
  const res = await fetch('/api/generate');
  const data = await res.json();
  const email = data.email;
  document.getElementById("emailDisplay").innerText = email;
  loadInbox(data.token);
}

async function loadInbox(token) {
  setInterval(async () => {
    const res = await fetch('/api/inbox?token=' + token);
    const data = await res.json();
    const inboxEl = document.getElementById("inbox");
    inboxEl.innerHTML = data.map(msg => `
      <div class="p-2 bg-white my-2 rounded shadow">
        <div class="font-semibold">${msg.from.address}</div>
        <div class="text-sm">${msg.subject}</div>
      </div>
    `).join('');
  }, 10000);
}
