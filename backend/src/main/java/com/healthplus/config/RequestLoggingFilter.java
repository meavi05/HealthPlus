package com.healthplus.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
public class RequestLoggingFilter extends OncePerRequestFilter {
  private static final Logger log = LoggerFactory.getLogger(RequestLoggingFilter.class);
  private static final String REQUEST_ID_KEY = "requestId";

  @Override
  protected void doFilterInternal(
      HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
      throws ServletException, IOException {
    long startedAtMs = System.currentTimeMillis();
    String requestId = UUID.randomUUID().toString().substring(0, 8);
    MDC.put(REQUEST_ID_KEY, requestId);

    try {
      filterChain.doFilter(request, response);
    } finally {
      long durationMs = System.currentTimeMillis() - startedAtMs;
      String query = request.getQueryString();
      String path = query == null ? request.getRequestURI() : request.getRequestURI() + "?" + query;
      String user = request.getRemoteUser() == null ? "anonymous" : request.getRemoteUser();

      log.info(
          "HTTP {} {} -> {} ({} ms, user={})",
          request.getMethod(),
          path,
          response.getStatus(),
          durationMs,
          user);
      MDC.remove(REQUEST_ID_KEY);
    }
  }
}
