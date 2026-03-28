FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    ghostscript poppler-utils qpdf ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Non-root user
RUN useradd -m -u 10001 sandbox
USER sandbox
WORKDIR /home/sandbox

# Simple entrypoint that runs a safe-ish pipeline without network.
# You can replace this with your own preflight commands.
COPY --chown=sandbox:sandbox run.sh /home/sandbox/run.sh
RUN chmod +x /home/sandbox/run.sh

ENTRYPOINT ["/home/sandbox/run.sh"]
