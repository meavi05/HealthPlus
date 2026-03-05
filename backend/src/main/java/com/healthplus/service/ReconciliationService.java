package com.healthplus.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.sql.PreparedStatement;
import java.sql.Statement;

@Service
public class ReconciliationService {
    private final JdbcTemplate jdbcTemplate;

    public ReconciliationService(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Scheduled(fixedDelayString = "${app.reconciliation-interval-ms:300000}")
    public void reconcilePayments() {
        KeyHolder keyHolder = new GeneratedKeyHolder();
        jdbcTemplate.update(connection -> {
            PreparedStatement ps = connection.prepareStatement(
                    "INSERT INTO reconciliation_runs (notes) VALUES (?)",
                    Statement.RETURN_GENERATED_KEYS
            );
            ps.setString(1, "Automatic payment intent reconciliation");
            return ps;
        }, keyHolder);

        Long runId = keyHolder.getKey() == null ? null : keyHolder.getKey().longValue();
        if (runId == null) {
            return;
        }

        Integer checked = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM payment_intents WHERE status IN ('pending', 'created')",
                Integer.class
        );

        int repaired = jdbcTemplate.update(
                "UPDATE payment_intents SET status = 'expired', updated_at = CURRENT_TIMESTAMP WHERE status = 'created' AND datetime(created_at) <= datetime('now', '-15 minutes')"
        );

        jdbcTemplate.update(
                "UPDATE reconciliation_runs SET checked_intents = ?, repaired_intents = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?",
                checked == null ? 0 : checked,
                repaired,
                runId
        );
    }
}
