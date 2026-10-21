from machine import Pin
from time import sleep

# GPIO25 controls the LED through a current-limiting resistor.
led = Pin(25, Pin.OUT)

while True:
    led.value(1)   # ON
    sleep(1)
    led.value(0)   # OFF
    sleep(1)
