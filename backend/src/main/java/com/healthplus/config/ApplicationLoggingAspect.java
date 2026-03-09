package com.healthplus.config;

import java.util.Arrays;
import java.util.stream.Collectors;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

@Aspect
@Component
public class ApplicationLoggingAspect {
  private static final Logger log = LoggerFactory.getLogger(ApplicationLoggingAspect.class);

  @Around(
      "execution(public * com.healthplus.controller..*(..)) || execution(public * com.healthplus.service..*(..))")
  public Object logMethodExecution(ProceedingJoinPoint joinPoint) throws Throwable {
    long startedAtNs = System.nanoTime();
    String method = joinPoint.getSignature().toShortString();
    String args = summarizeArgs(joinPoint.getArgs());

    log.info("Entering {} args=[{}]", method, args);

    try {
      Object result = joinPoint.proceed();
      long durationMs = (System.nanoTime() - startedAtNs) / 1_000_000;
      log.info("Exiting {} ({} ms)", method, durationMs);
      return result;
    } catch (Throwable ex) {
      long durationMs = (System.nanoTime() - startedAtNs) / 1_000_000;
      log.error("Failed {} after {} ms: {}", method, durationMs, ex.getMessage(), ex);
      throw ex;
    }
  }

  private String summarizeArgs(Object[] args) {
    return Arrays.stream(args)
        .map(this::summarizeValue)
        .collect(Collectors.joining(", "));
  }

  private String summarizeValue(Object value) {
    if (value == null) {
      return "null";
    }
    return value.getClass().getSimpleName();
  }
}
