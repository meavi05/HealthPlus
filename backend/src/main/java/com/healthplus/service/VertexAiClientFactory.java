package com.healthplus.service;

import com.google.genai.Client;
import com.google.genai.types.HttpOptions;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
class VertexAiClientFactory {
    private final boolean enabled;
    private final String project;
    private final String location;
    private final String apiKey;
    private final String apiVersion;

    VertexAiClientFactory(@Value("${app.ocr.vertexai.enabled:true}") boolean enabled,
                          @Value("${app.ocr.vertexai.project:}") String project,
                          @Value("${app.ocr.vertexai.location:global}") String location,
                          @Value("${app.ocr.vertexai.api-key:}") String apiKey,
                          @Value("${app.ocr.vertexai.api-version:v1}") String apiVersion) {
        this.enabled = enabled;
        this.project = project == null ? "" : project.trim();
        this.location = location == null ? "" : location.trim();
        this.apiKey = apiKey == null ? "" : apiKey.trim();
        this.apiVersion = apiVersion == null || apiVersion.isBlank() ? "v1" : apiVersion.trim();
    }

    boolean isEnabled() {
        return enabled;
    }

    Client newClient() {
        Client.Builder builder = Client.builder()
                .vertexAI(true)
                .httpOptions(HttpOptions.builder().apiVersion(apiVersion).build());
        if (!apiKey.isBlank()) {
            builder.apiKey(apiKey);
        } else if (!project.isBlank() && !location.isBlank()) {
            builder.project(project);
            builder.location(location);
        }
        return builder.build();
    }
}
