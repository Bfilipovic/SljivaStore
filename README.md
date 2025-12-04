Clone your repo:

git clone https://github.com/Bfilipovic/Nomin.git
cd Nomin

Make scripts executable:

chmod +x install_dependencies.sh run_all.sh

Install everything:

./install_dependencies.sh

Run all services:

./run_all.sh

-----------------------------------------------------------------------------------------------------------------

Node.js Version Setup Instructions for Users
Check current Node version

node -v

If Node version is not 18.20.8, follow these steps:
1. Remove existing Node.js (optional but recommended)

    On Ubuntu/Debian:

sudo apt remove nodejs
sudo apt purge nodejs
sudo apt autoremove

    On macOS (if installed with Homebrew):

brew uninstall node

    On Windows:
    Use Add or Remove Programs to uninstall Node.js or uninstall from wherever you installed it.

2. Install nvm (Node Version Manager)

curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.4/install.sh | bash

    Then reload your shell:

export NVM_DIR="$([ -z "${XDG_CONFIG_HOME-}" ] && printf %s "${HOME}/.nvm" || printf %s "${XDG_CONFIG_HOME}/nvm")"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

Or just close and reopen your terminal.
3. Install and use the correct Node.js version

nvm install 18.20.8
nvm use 18.20.8

Make sure it is the default version for future terminals:

nvm alias default 18.20.8

4. Verify

node -v
# Should print: v18.20.8