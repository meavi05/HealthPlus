package com.healthplus.security;

import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.client.userinfo.DefaultOAuth2UserService;
import org.springframework.security.oauth2.client.userinfo.OAuth2UserRequest;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.user.DefaultOAuth2User;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.stereotype.Service;

import java.util.HashSet;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

@Service
public class RoleAwareOAuth2UserService extends DefaultOAuth2UserService {
    private final LocalUserService localUserService;

    public RoleAwareOAuth2UserService(LocalUserService localUserService) {
        this.localUserService = localUserService;
    }

    @Override
    public OAuth2User loadUser(OAuth2UserRequest userRequest) throws OAuth2AuthenticationException {
        OAuth2User oauth2User = super.loadUser(userRequest);
        Map<String, Object> attrs = oauth2User.getAttributes();

        String email = attrs.get("email") instanceof String e && !e.isBlank()
                ? e.trim().toLowerCase(Locale.ROOT)
                : null;

        String role = email == null ? "ROLE_USER" : localUserService.roleForEmail(email);

        Set<GrantedAuthority> authorities = new HashSet<>(oauth2User.getAuthorities());
        authorities.add(new SimpleGrantedAuthority(role));

        String userNameAttribute = userRequest.getClientRegistration()
                .getProviderDetails()
                .getUserInfoEndpoint()
                .getUserNameAttributeName();
        if (userNameAttribute == null || userNameAttribute.isBlank()) {
            userNameAttribute = "sub";
        }

        return new DefaultOAuth2User(authorities, attrs, userNameAttribute);
    }
}
