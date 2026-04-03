package com.healthplus;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.core.env.Environment;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class HealthPlusApplication {
    private static final Logger log = LoggerFactory.getLogger(HealthPlusApplication.class);

    public static void main(String[] args) {
        SpringApplication.run(HealthPlusApplication.class, args);
    }

    @Bean
    ApplicationRunner logDatasourceUrl(Environment environment) {
        return args -> log.info("Using datasource URL: {}", environment.getProperty("spring.datasource.url"));
    }
}
