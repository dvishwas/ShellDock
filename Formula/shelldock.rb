class Shelldock < Formula
  desc "Multi-tab terminal manager with smart features and configurable layout"
  homepage "https://github.com/shelldock/shelldock"
  url "https://github.com/shelldock/shelldock/releases/download/v1.0.0/shelldock-1.0.0.tar.gz"
  sha256 "PLACEHOLDER"
  license "MIT"

  depends_on "node"

  def install
    system "npm", "install", "--production"
    libexec.install Dir["*"]
    bin.install_symlink libexec/"bin/shelldock"
  end

  def caveats
    <<~EOS
      Launch with:
        shelldock
    EOS
  end

  test do
    assert_match "ShellDock v#{version}", shell_output("#{bin}/shelldock --version")
  end
end
