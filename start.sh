#!/bin/sh

mkdir -p logs

for file in server.log console.log; do
  base=$(basename $file .log)
  if [ -f $file ]; then
    gzip -9 $file
    mv -v "${file}.gz" "logs/${base}-$(date +%Y%m%d)-$(printf "%03d" $(( $(ls logs/${base}*.gz 2>/dev/null | wc -l) + 1))).log.gz"
  fi
done

/home/mint/Downloads/jdk-17.0.9/bin/java -Xmx3G -Xms2G -jar minecraft_1_20_4.jar nogui 2>&1 | tee console.log

for file in server.log console.log; do
  base=$(basename $file .log)
  if [ -f $file ]; then
    gzip -9 $file
    mv -v "${file}.gz" "logs/${base}-$(date +%Y%m%d)-$(printf "%03d" $(( $(ls logs/${base}*.gz 2>/dev/null | wc -l) + 1))).log.gz"
  fi
done
