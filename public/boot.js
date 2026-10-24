(function () {
  var ready = false;
  function recover() {
    if (ready || document.getElementById("launch-recovery")) return;
    var box = document.createElement("div");
    box.id = "launch-recovery";
    box.setAttribute("role", "alert");
    box.style.cssText =
      "position:fixed;inset:0;z-index:100;background:#fffaf0;color:#294a3f;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;padding:30px;font:16px/1.6 system-ui,sans-serif";
    box.innerHTML =
      '<h1 style="font:32px Georgia,serif">Let’s get your adventure started.</h1><p>The game could not finish loading in this window.</p><p>Open the game in Safari, Chrome, Edge, or Firefox. A download preview cannot play it.</p><button id="launch-simple" style="padding:14px 24px;background:#315b49;color:white;border:0;border-radius:12px;font:inherit;cursor:pointer">Try simple graphics</button><button id="launch-reload" style="margin-top:14px;padding:10px 20px;border:1px solid #9bab8b;border-radius:10px;background:#f2f1e5;font:inherit;cursor:pointer">Reload game</button>';
    document.body.appendChild(box);
    document.getElementById("launch-simple").onclick = function () {
      var next = new URL(window.location.href);
      next.searchParams.set("graphics", "simple");
      window.location.href = next.href;
    };
    document.getElementById("launch-reload").onclick = function () {
      window.location.reload();
    };
  }
  window.addEventListener("maisie-ready", function () {
    ready = true;
    var box = document.getElementById("launch-recovery");
    if (box) box.remove();
  });
  window.addEventListener(
    "error",
    function (event) {
      if (
        !ready &&
        (event.error || (event.target && event.target.tagName === "SCRIPT"))
      )
        recover();
    },
    true,
  );
  window.setTimeout(recover, 12000);
})();
