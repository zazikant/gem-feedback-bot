/**
 * GEM Feedback Widget — Embed Script
 *
 * Usage (paste into WordPress Elementor HTML block or any page):
 *
 * <script>
 *   (function(d,t){
 *     var v=d.createElement(t),s=d.getElementsByTagName(t)[0];
 *     v.onload=function(){
 *       window.gemFeedback.load({
 *         url: "https://gem-feedback-bot.vercel.app"
 *       }).then(function(){
 *         setTimeout(function(){ window.gemFeedback.open(); }, 1000);
 *       });
 *     };
 *     v.src="https://gem-feedback-bot.vercel.app/widget.js";
 *     v.type="text/javascript";
 *     s.parentNode.insertBefore(v,s);
 *   })(document,'script');
 * </script>
 *
 * Or simply:
 * <script src="https://gem-feedback-bot.vercel.app/widget.js" data-auto-open="true"></script>
 */

(function (window, document) {
  "use strict";

  var WIDGET_URL = "https://gem-feedback-bot.vercel.app/widget";
  var SCRIPT_TAG = document.currentScript;
  var autoOpen = SCRIPT_TAG && SCRIPT_TAG.getAttribute("data-auto-open") === "true";

  // State
  var isOpen = false;
  var isLoaded = false;
  var container = null;
  var iframe = null;
  var toggleBtn = null;
  var overlay = null;

  // SVG icons
  var chatIcon = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>';

  var closeIcon = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';

  // Inject styles
  function injectStyles() {
    var style = document.createElement("style");
    style.id = "gem-feedback-styles";
    style.textContent = [
      "@keyframes gem-fade-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }",
      "@keyframes gem-fade-out { from { opacity: 1; transform: translateY(0); } to { opacity: 0; transform: translateY(10px); } }",
      "@keyframes gem-bounce { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.1); } }",
      "",
      "#gem-feedback-root { position: fixed; z-index: 999999; font-family: system-ui, -apple-system, sans-serif; }",
      "",
      "#gem-feedback-toggle {",
      "  position: fixed; bottom: 24px; right: 24px; width: 56px; height: 56px;",
      "  border-radius: 50%; border: none; cursor: pointer; outline: none;",
      "  background: #1a1a2e; color: white; box-shadow: 0 4px 16px rgba(0,0,0,0.25);",
      "  display: flex; align-items: center; justify-content: center;",
      "  transition: transform 0.2s ease, box-shadow 0.2s ease;",
      "  z-index: 999999;",
      "}",
      "#gem-feedback-toggle:hover { transform: scale(1.08); box-shadow: 0 6px 20px rgba(0,0,0,0.3); }",
      "#gem-feedback-toggle:active { transform: scale(0.95); }",
      "#gem-feedback-toggle.gem-open { background: #6b7280; }",
      "#gem-feedback-toggle svg { width: 24px; height: 24px; }",
      "",
      "#gem-feedback-overlay {",
      "  position: fixed; inset: 0; background: rgba(0,0,0,0.3);",
      "  z-index: 999998; opacity: 0; pointer-events: none;",
      "  transition: opacity 0.3s ease;",
      "}",
      "#gem-feedback-overlay.gem-visible { opacity: 1; pointer-events: auto; }",
      "",
      "#gem-feedback-container {",
      "  position: fixed; bottom: 92px; right: 24px;",
      "  width: 380px; height: 560px; max-height: calc(100vh - 120px);",
      "  border-radius: 16px; overflow: hidden;",
      "  box-shadow: 0 12px 48px rgba(0,0,0,0.2);",
      "  z-index: 999999;",
      "  animation: gem-fade-in 0.3s ease forwards;",
      "}",
      "#gem-feedback-container.gem-closing { animation: gem-fade-out 0.2s ease forwards; }",
      "",
      "#gem-feedback-iframe {",
      "  width: 100%; height: 100%; border: none; border-radius: 16px;",
      "}",
      "",
      "@media (max-width: 480px) {",
      "  #gem-feedback-container {",
      "    width: calc(100vw - 32px); height: calc(100vh - 120px);",
      "    bottom: 88px; right: 16px; border-radius: 12px;",
      "  }",
      "  #gem-feedback-toggle { bottom: 16px; right: 16px; width: 52px; height: 52px; }",
      "}",
    ].join("\n");
    document.head.appendChild(style);
  }

  // Create widget DOM
  function createWidget() {
    // Overlay (mobile dismiss)
    overlay = document.createElement("div");
    overlay.id = "gem-feedback-overlay";
    overlay.addEventListener("click", function () { close(); });
    document.body.appendChild(overlay);

    // Toggle button
    toggleBtn = document.createElement("button");
    toggleBtn.id = "gem-feedback-toggle";
    toggleBtn.setAttribute("aria-label", "Open GEM Feedback");
    toggleBtn.innerHTML = chatIcon;
    toggleBtn.addEventListener("click", function () {
      if (isOpen) close(); else open();
    });
    document.body.appendChild(toggleBtn);

    isLoaded = true;
  }

  // Open widget
  function open() {
    if (!isLoaded) createWidget();
    if (isOpen) return;

    if (!container) {
      container = document.createElement("div");
      container.id = "gem-feedback-container";

      iframe = document.createElement("iframe");
      iframe.id = "gem-feedback-iframe";
      iframe.src = WIDGET_URL;
      iframe.setAttribute("allow", "clipboard-write");
      container.appendChild(iframe);

      document.body.appendChild(container);
    } else {
      container.style.display = "";
      container.classList.remove("gem-closing");
    }

    overlay.classList.add("gem-visible");
    toggleBtn.classList.add("gem-open");
    toggleBtn.innerHTML = closeIcon;
    toggleBtn.setAttribute("aria-label", "Close GEM Feedback");
    isOpen = true;
  }

  // Close widget
  function close() {
    if (!isOpen) return;

    container.classList.add("gem-closing");
    overlay.classList.remove("gem-visible");
    toggleBtn.classList.remove("gem-open");
    toggleBtn.innerHTML = chatIcon;
    toggleBtn.setAttribute("aria-label", "Open GEM Feedback");

    setTimeout(function () {
      if (container) container.style.display = "none";
      container.classList.remove("gem-closing");
    }, 200);

    isOpen = false;
  }

  // Public API (similar to Voiceflow pattern)
  window.gemFeedback = {
    load: function (config) {
      if (config && config.url) WIDGET_URL = config.url + "/widget";
      injectStyles();
      createWidget();
      return Promise.resolve();
    },
    open: function () {
      open();
    },
    close: function () {
      close();
    },
    toggle: function () {
      if (isOpen) close(); else open();
    },
  };

  // Auto-init if loaded via <script src="..."> (not the function wrapper)
  if (SCRIPT_TAG && SCRIPT_TAG.src && SCRIPT_TAG.src.indexOf("widget.js") !== -1) {
    injectStyles();
    createWidget();
    if (autoOpen) {
      setTimeout(function () { open(); }, 1000);
    }
  }

})(window, document);
