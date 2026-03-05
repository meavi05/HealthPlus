package com.healthplus;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class HealthPlusApplication {
    public static void main(String[] args) {
        SpringApplication.run(HealthPlusApplication.class, args);
    }
}
