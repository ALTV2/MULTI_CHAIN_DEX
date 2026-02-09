package com.multichain.dex.repository;

import com.multichain.dex.domain.entity.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.test.context.ActiveProfiles;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

@DataJpaTest
@ActiveProfiles("test")
class UserRepositoryTest {

    @Autowired
    private UserRepository userRepository;

    private static final String WALLET_ADDRESS = "0x1234567890abcdef1234567890abcdef12345678";

    @BeforeEach
    void setUp() {
        userRepository.deleteAll();
    }

    @Test
    @DisplayName("should save and find user by primary wallet address")
    void shouldSaveAndFindUserByPrimaryWalletAddress() {
        // Given
        User user = User.builder()
            .primaryWalletAddress(WALLET_ADDRESS)
            .build();

        userRepository.save(user);

        // When
        Optional<User> found = userRepository.findByPrimaryWalletAddress(WALLET_ADDRESS);

        // Then
        assertThat(found).isPresent();
        assertThat(found.get().getPrimaryWalletAddress()).isEqualTo(WALLET_ADDRESS);
        assertThat(found.get().getId()).isNotNull();
        assertThat(found.get().getCreatedAt()).isNotNull();
    }

    @Test
    @DisplayName("should return empty when user not found")
    void shouldReturnEmptyWhenUserNotFound() {
        // When
        Optional<User> found = userRepository.findByPrimaryWalletAddress("0xnonexistent");

        // Then
        assertThat(found).isEmpty();
    }

    @Test
    @DisplayName("should update user last login time")
    void shouldUpdateUserLastLoginTime() {
        // Given
        User user = User.builder()
            .primaryWalletAddress(WALLET_ADDRESS)
            .build();

        user = userRepository.save(user);
        assertThat(user.getLastLoginAt()).isNull();

        // When
        user.setLastLoginAt(java.time.LocalDateTime.now());
        user = userRepository.save(user);

        // Then
        Optional<User> found = userRepository.findById(user.getId());
        assertThat(found).isPresent();
        assertThat(found.get().getLastLoginAt()).isNotNull();
    }

    @Test
    @DisplayName("should check if user exists by wallet address")
    void shouldCheckIfUserExistsByWalletAddress() {
        // Given
        User user = User.builder()
            .primaryWalletAddress(WALLET_ADDRESS)
            .build();
        userRepository.save(user);

        // When/Then
        assertThat(userRepository.existsByPrimaryWalletAddress(WALLET_ADDRESS)).isTrue();
        assertThat(userRepository.existsByPrimaryWalletAddress("0xnonexistent")).isFalse();
    }
}
