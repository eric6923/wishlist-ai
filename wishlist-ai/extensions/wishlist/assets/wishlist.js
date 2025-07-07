;(() => {
  // Add CSS styles
  const css = `
    .wishlist-block {
      display: inline-block;
      position: relative;
    }
    
    .wishlist-btn {
      display: flex;
      align-items: center;
      gap: 8px;
      background: transparent;
      border: 1px solid #ddd;
      padding: 10px 16px;
      border-radius: 4px;
      cursor: pointer;
      transition: all 0.2s;
      font-size: 14px;
      color: #000;
      font-family: inherit;
    }
    
    .wishlist-btn:hover {
      border-color: #333;
    }
    
    .wishlist-btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
    
    .wishlist-btn.active {
      color: #e74c3c;
      border-color: #e74c3c;
    }
    
    .wishlist-btn.active .wishlist-empty {
      display: none;
    }
    
    .wishlist-btn.active .wishlist-filled {
      display: block !important;
    }
    
    .wishlist-message {
      position: absolute;
      top: 100%;
      left: 50%;
      transform: translateX(-50%);
      background: #333;
      color: #fff;
      padding: 8px 12px;
      border-radius: 4px;
      font-size: 12px;
      white-space: nowrap;
      z-index: 1000;
      margin-top: 8px;
    }
    
    .wishlist-message::before {
      content: '';
      position: absolute;
      top: -4px;
      left: 50%;
      transform: translateX(-50%);
      width: 0;
      height: 0;
      border-left: 4px solid transparent;
      border-right: 4px solid transparent;
      border-bottom: 4px solid #333;
    }
    
    .wishlist-message--success {
      background: #28a745;
    }
    
    .wishlist-message--error {
      background: #dc3545;
    }
  `

  // Inject CSS
  const style = document.createElement("style")
  style.textContent = css
  document.head.appendChild(style)

  function initWishlist() {
    const wishlistBlocks = document.querySelectorAll(".wishlist-block:not([data-initialized])")

    wishlistBlocks.forEach((block) => {
      const button = block.querySelector("[data-wishlist-toggle]")
      const message = block.querySelector("[data-wishlist-message]")
      const productId = block.dataset.productId
      const customerId = block.dataset.customerId
      const shopDomain = block.dataset.shopDomain

      if (!button || !productId) return

      // Mark as initialized
      block.setAttribute("data-initialized", "true")

      // Check initial status
      checkWishlistStatus(block, customerId, productId, shopDomain)

      // Handle click
      button.addEventListener("click", (e) => {
        e.preventDefault()

        if (!customerId) {
          showMessage(message, "Please log in to use wishlist", "error")
          return
        }

        toggleWishlist(block, customerId, productId, shopDomain)
      })
    })
  }

  function toggleWishlist(block, customerId, productId, shopDomain) {
    const button = block.querySelector("[data-wishlist-toggle]")
    const message = block.querySelector("[data-wishlist-message]")
    const isActive = button.classList.contains("active")

    button.disabled = true

    const action = isActive ? "remove" : "add"
    const url = `/apps/wishlist?action=${action}&customer_id=${customerId}&product_id=${productId}&shop=${shopDomain}`

    fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.success) {
          updateButtonState(button, !isActive)
          const messageText = isActive ? "Removed from wishlist" : "Added to wishlist!"
          showMessage(message, messageText, "success")
        } else {
          showMessage(message, data.error || "Something went wrong", "error")
        }
      })
      .catch((error) => {
        console.error("Wishlist error:", error)
        showMessage(message, "Something went wrong", "error")
      })
      .finally(() => {
        button.disabled = false
      })
  }

  function checkWishlistStatus(block, customerId, productId, shopDomain) {
    if (!customerId) return

    const url = `/apps/wishlist?action=check&customer_id=${customerId}&product_id=${productId}&shop=${shopDomain}`

    fetch(url)
      .then((response) => response.json())
      .then((data) => {
        if (data.success) {
          const button = block.querySelector("[data-wishlist-toggle]")
          updateButtonState(button, data.inWishlist)
        }
      })
      .catch((error) => {
        console.error("Wishlist check error:", error)
      })
  }

  function updateButtonState(button, isActive) {
    button.classList.toggle("active", isActive)
    const text = button.querySelector(".wishlist-text")
    if (text) {
      text.textContent = isActive ? "Remove from Wishlist" : "Add to Wishlist"
    }
  }

  function showMessage(messageEl, text, type) {
    if (!messageEl) return

    messageEl.textContent = text
    messageEl.className = `wishlist-message wishlist-message--${type}`
    messageEl.style.display = "block"

    setTimeout(() => {
      messageEl.style.display = "none"
    }, 3000)
  }

  // Initialize
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initWishlist)
  } else {
    initWishlist()
  }

  // Re-initialize on section loads
  document.addEventListener("shopify:section:load", initWishlist)
})()
