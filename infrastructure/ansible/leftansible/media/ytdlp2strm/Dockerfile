ARG YTDLP2STRM_BASE_IMAGE
FROM ${YTDLP2STRM_BASE_IMAGE}

RUN sed -i 's/"ytdlp2strm_host" : "127.0.0.1"/"ytdlp2strm_host" : "0.0.0.0"/' /opt/ytdlp2STRM/config/config.example.json \
    && printf '[]\n' > /opt/ytdlp2STRM/config/crons.json \
    && chown -R 1008:1008 /opt/ytdlp2STRM
