;(() => {
  console.log("Wishlist JS loaded")

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
    
    .wishlist-score {
      font-size: 11px;
      color: #666;
      margin-top: 4px;
      text-align: center;
    }
    
    .wishlist-score.high {
      color: #28a745;
      font-weight: bold;
    }
    
    .wishlist-score.medium {
      color: #ffc107;
      font-weight: bold;
    }
    
    .wishlist-score.low {
      color: #dc3545;
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
    console.log("Initializing wishlist...")
    const wishlistBlocks = document.querySelectorAll(".wishlist-block:not([data-initialized])")
    console.log("Found wishlist blocks:", wishlistBlocks.length)

    wishlistBlocks.forEach((block, index) => {
      console.log(`Processing block ${index}:`, block)

      const button = block.querySelector("[data-wishlist-toggle]")
      const message = block.querySelector("[data-wishlist-message]")
      const productId = block.dataset.productId
      const customerId = block.dataset.customerId
      const shopDomain = block.dataset.shopDomain

      console.log("Block data:", { productId, customerId, shopDomain })

      if (!button) {
        console.error("Button not found in block:", block)
        return
      }

      if (!productId || productId === "") {
        console.error("Product ID is missing or empty.")
        showMessage(message, "Product ID missing - add to product page or set in block settings", "error")
        return
      }

      // Add conversion score display
      const scoreDiv = document.createElement("div")
      scoreDiv.className = "wishlist-score"
      scoreDiv.style.display = "none"
      block.appendChild(scoreDiv)

      // Mark as initialized
      block.setAttribute("data-initialized", "true")

      // Check initial status
      if (customerId && customerId !== "") {
        checkWishlistStatus(block, customerId, productId, shopDomain)
      }

      // Handle click
      button.addEventListener("click", (e) => {
        console.log("Wishlist button clicked")
        e.preventDefault()

        if (!customerId || customerId === "") {
          console.log("Customer not logged in")
          showMessage(message, "Please log in to use wishlist", "error")
          return
        }

        if (!productId || productId === "") {
          console.log("Product ID missing")
          showMessage(message, "Product ID missing", "error")
          return
        }

        toggleWishlist(block, customerId, productId, shopDomain)
      })
    })
  }

  function toggleWishlist(block, customerId, productId, shopDomain) {
    console.log("Toggling wishlist:", { customerId, productId, shopDomain })

    const button = block.querySelector("[data-wishlist-toggle]")
    const message = block.querySelector("[data-wishlist-message]")
    const scoreDiv = block.querySelector(".wishlist-score")
    const isActive = button.classList.contains("active")

    button.disabled = true

    const action = isActive ? "remove" : "add"
    const url = `/apps/wishlist?action=${action}&customer_id=${customerId}&product_id=${productId}&shop=${shopDomain}`

    console.log("Making API call to:", url)

    fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    })
      .then((response) => {
        console.log("API response status:", response.status)
        return response.json()
      })
      .then((data) => {
        console.log("API response data:", data)
        if (data.success) {
          updateButtonState(button, !isActive)
          const messageText = isActive ? "Removed from wishlist" : "Added to wishlist!"
          showMessage(message, messageText, "success")

          // Show conversion score if available
          if (data.conversionScore && !isActive) {
            showConversionScore(scoreDiv, data.conversionScore)
          } else if (isActive) {
            scoreDiv.style.display = "none"
          }
        } else {
          console.error("API error:", data.error)
          showMessage(message, data.error || "Something went wrong", "error")
        }
      })
      .catch((error) => {
        console.error("Wishlist fetch error:", error)
        showMessage(message, "Network error - check console", "error")
      })
      .finally(() => {
        button.disabled = false
      })
  }

  function checkWishlistStatus(block, customerId, productId, shopDomain) {
    if (!customerId) return

    const url = `/apps/wishlist?action=check&customer_id=${customerId}&product_id=${productId}&shop=${shopDomain}`
    console.log("Checking wishlist status:", url)

    fetch(url)
      .then((response) => response.json())
      .then((data) => {
        console.log("Wishlist status check:", data)
        if (data.success) {
          const button = block.querySelector("[data-wishlist-toggle]")
          const scoreDiv = block.querySelector(".wishlist-score")
          updateButtonState(button, data.inWishlist)

          // Show conversion score if available
          if (data.conversionScore && data.inWishlist) {
            showConversionScore(scoreDiv, data.conversionScore)
          }
        }
      })
      .catch((error) => {
        console.error("Wishlist status check error:", error)
      })
  }

  function updateButtonState(button, isActive) {
    console.log("Updating button state:", isActive)
    button.classList.toggle("active", isActive)
    const text = button.querySelector(".wishlist-text")
    if (text) {
      text.textContent = isActive ? "Remove from Wishlist" : "Add to Wishlist"
    }
  }

  function showConversionScore(scoreDiv, score) {
    if (!scoreDiv) return

    let scoreClass = "low"
    let scoreText = `${score}% likely to buy`

    if (score >= 70) {
      scoreClass = "high"
      scoreText = `🔥 ${score}% likely to buy`
    } else if (score >= 40) {
      scoreClass = "medium"
      scoreText = `⚡ ${score}% likely to buy`
    }

    scoreDiv.textContent = scoreText
    scoreDiv.className = `wishlist-score ${scoreClass}`
    scoreDiv.style.display = "block"
  }

  function showMessage(messageEl, text, type) {
    if (!messageEl) return

    console.log("Showing message:", text, type)
    messageEl.textContent = text
    messageEl.className = `wishlist-message wishlist-message--${type}`
    messageEl.style.display = "block"

    setTimeout(() => {
      messageEl.style.display = "none"
    }, 5000)
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
