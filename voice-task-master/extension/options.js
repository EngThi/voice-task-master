const KEY = "vtm_backend_url_v1";
const backendUrl = document.getElementById("backendUrl");
const status = document.getElementById("status");
const save = document.getElementById("save");

function setStatus(t){ status.textContent = t || ""; }

(async function init(){
  const data = await chrome.storage.local.get([KEY]);
  backendUrl.value = data[KEY] || "";
})();

save.addEventListener("click", async () => {
  await chrome.storage.local.set({ [KEY]: backendUrl.value.trim() });
  setStatus("Saved.");
});
