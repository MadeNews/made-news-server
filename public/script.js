// Enhanced interactive animations
document.addEventListener("DOMContentLoaded", function () {
  // Animate elements on scroll
  const observerOptions = {
    threshold: 0.15,
    rootMargin: "0px 0px -80px 0px",
  };

  const observer = new IntersectionObserver(function (entries) {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = "1";
        entry.target.style.transform = "translateY(0)";
      }
    });
  }, observerOptions);

  // Observe all sections with staggered animation
  document
    .querySelectorAll(".step, .style-card, .testimonial")
    .forEach((el, index) => {
      el.style.transition = `opacity 0.8s ease ${index * 0.1}s, transform 0.8s ease ${index * 0.1}s`; // Set staggered transition only
      observer.observe(el);
    });

  // Enhanced click animation for download buttons
  document.querySelectorAll(".download-btn").forEach((btn) => {
    btn.addEventListener("click", function (e) {
      e.preventDefault();

      // Create ripple effect
      const ripple = document.createElement("span");
      ripple.style.position = "absolute";
      ripple.style.borderRadius = "50%";
      ripple.style.background = "rgba(255, 230, 102, 0.6)";
      ripple.style.transform = "scale(0)";
      ripple.style.animation = "ripple 0.6s linear";
      ripple.style.left = "50%";
      ripple.style.top = "50%";
      const size = Math.max(this.offsetWidth, this.offsetHeight) * 2; // Dynamic sizing
      ripple.style.width = ripple.style.height = `${size}px`;
      ripple.style.marginLeft = ripple.style.marginTop = `-${size / 2}px`;

      this.appendChild(ripple);

      setTimeout(() => {
        ripple.remove();
      }, 600);

      // Button press animation
      this.style.transform = "scale(0.95)";
      setTimeout(() => {
        this.style.transform = "scale(1)";
      }, 150);

      // Add your APK download link here
      // window.location.href = 'path/to/your/madenews.apk';
    });
  });

  // Add some extra flair to style cards
  document.querySelectorAll(".style-card").forEach((card) => {
    card.addEventListener("mouseenter", function () {
      // Add subtle tilt effect on hover
      this.style.transition = "all 0.3s ease";
    });

    card.addEventListener("mouseleave", function () {
      this.style.transform = "translateY(0) rotate(0deg)";
    });
  });

  // Add CSS animation for ripple effect
  if (!document.getElementById("ripple-styles")) {
    const style = document.createElement("style");
    style.id = "ripple-styles";
    style.textContent = `
            @keyframes ripple {
                to {
                    transform: scale(4);
                    opacity: 0;
                }
            }
        `;
    document.head.appendChild(style);
  }

  // Smooth scrolling for internal links
  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener("click", function (e) {
      e.preventDefault();
      const target = document.querySelector(this.getAttribute("href"));
      if (target) {
        target.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }
    });
  });

  document.querySelectorAll(".download-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const link = document.createElement("a");
      link.href = "/madenews.apk"; // public path to your APK
      link.download = "madenews.apk"; // suggest filename
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    });
  });
});