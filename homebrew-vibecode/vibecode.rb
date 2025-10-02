class Vibecode < Formula
  desc "First cloud IDE for Apple's native containerization"
  homepage "https://github.com/ryanmaclean/vibecode-webgui"
  url "https://github.com/ryanmaclean/vibecode-webgui/archive/refs/tags/v1.0.0-apple-container.tar.gz"
  sha256 "PLACEHOLDER" # Will be updated
  license "Apache-2.0"

  depends_on cask: "container"
  depends_on :macos => :sequoia
  depends_on arch: :arm64

  def install
    bin.install "artifacts/apple-container/run-stack.sh" => "vibecode"
    bin.install "artifacts/apple-container/datadog-monitor.sh" => "vibecode-monitor"
    
    # Install documentation
    doc.install "docs/APPLE_CONTAINER_SUCCESS.md"
    doc.install "artifacts/apple-container/README.md"
  end

  def post_install
    # Start container system service
    system "container", "system", "start"
  end

  def caveats
    <<~EOS
      VibeCode has been installed!

      Start VibeCode:
        vibecode

      Monitor with Datadog:
        export DD_API_KEY=your_key
        vibecode-monitor

      Access at: http://localhost:8080
      Default password: vibecode123

      Documentation: #{doc}/README.md
    EOS
  end

  test do
    system "container", "--version"
  end
end
