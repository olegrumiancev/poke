# Base (Debian)
FROM debian:12-slim

# Set Work Directory
WORKDIR /poketube
COPY . /poketube

# Expose Ports
EXPOSE 6003

# Install build deps + Node + Python 3.11
RUN apt-get update && apt-get install -y \
    ca-certificates curl gnupg make g++ \
    nodejs npm \
    python3.11 python3.11-venv python3.11-distutils \
    && ln -sf /usr/bin/python3.11 /usr/bin/python3 \
    && rm -rf /var/lib/apt/lists/*

# Make sure node-gyp uses Python 3.11 (has distutils) [web:39][web:44]
ENV PYTHON=/usr/bin/python3.11

# Install Packages
RUN npm install

# Run
CMD ["npm", "start"]
