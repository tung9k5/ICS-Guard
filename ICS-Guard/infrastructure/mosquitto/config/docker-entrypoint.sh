#!/bin/sh
set -eu

: "${MQTT_ICS_PASSWORD:?MQTT_ICS_PASSWORD is required}"
: "${MQTT_HARDWARE_PASSWORD:?MQTT_HARDWARE_PASSWORD is required}"
: "${MQTT_ATTACK_PASSWORD:?MQTT_ATTACK_PASSWORD is required}"

password_file=/mosquitto/data/passwords
umask 077

mosquitto_passwd -b -c "$password_file" ics-backend "$MQTT_ICS_PASSWORD"
mosquitto_passwd -b "$password_file" hardware-runtime-01 "$MQTT_HARDWARE_PASSWORD"
mosquitto_passwd -b "$password_file" attack-adapter "$MQTT_ATTACK_PASSWORD"

exec mosquitto -c /mosquitto/config/mosquitto.conf
